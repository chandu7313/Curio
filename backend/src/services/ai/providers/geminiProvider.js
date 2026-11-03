/**
 * Curio Backend — Google Gemini AI Provider
 *
 * Implements real-time Server-Sent Events (SSE) streaming via the official
 * Gemini REST endpoint (`streamGenerateContent?alt=sse`).
 *
 * Features:
 *   - Direct HTTP streaming via native fetch (Node.js 18+)
 *   - AbortSignal support for client cancellation
 *   - Error normalization (Auth, Rate Limits, Quota, Invalid Request)
 *   - Token usage extraction from usageMetadata
 *
 * @module backend/services/ai/providers/geminiProvider
 */

import { parseSSEStream } from '../../../utils/sse.js';
import { buildSystemPrompt, buildUserPrompt, buildFollowUpUserPrompt } from '../promptBuilder.js';
import { config } from '../../../config/env.js';

export class GeminiProvider {
  /**
   * @param {Object} [options]
   * @param {string} [options.apiKey]
   * @param {string} [options.model]
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey !== undefined ? options.apiKey : config.GEMINI_API_KEY;
    this.model = options.model || config.GEMINI_MODEL || 'gemini-2.0-flash';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  }

  get name() {
    return 'gemini';
  }

  /**
   * Check if this provider has an API key configured.
   * @returns {boolean}
   */
  isAvailable() {
    return Boolean(
      this.apiKey &&
      typeof this.apiKey === 'string' &&
      this.apiKey.trim().length > 0 &&
      this.apiKey !== 'your_gemini_api_key_here'
    );
  }

  /**
   * Normalize an error into a standardized Curio error object.
   * @param {Error|Response|any} err
   * @param {number} [status]
   * @returns {{ code: string, message: string, retryable: boolean }}
   */
  normalizeError(err, status = 500) {
    if (err?.name === 'AbortError') {
      return { code: 'CANCELLED', message: 'Generation was cancelled by the user.', retryable: false };
    }

    const msg = (err?.message || String(err)).toLowerCase();

    if (status === 401 || status === 403 || msg.includes('api_key') || msg.includes('permission_denied') || msg.includes('api key not valid')) {
      return {
        code: 'AUTHENTICATION_ERROR',
        message: 'Invalid or missing Google Gemini API key. Please check your backend configuration.',
        retryable: false,
      };
    }

    if (status === 429 || msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted')) {
      return {
        code: 'RATE_LIMITED',
        message: 'Google Gemini rate limit exceeded. Please wait a moment before trying again.',
        retryable: true,
      };
    }

    if (status === 400 || msg.includes('invalid_argument')) {
      return {
        code: 'INVALID_REQUEST',
        message: 'Gemini rejected the request payload as invalid.',
        retryable: false,
      };
    }

    if (status === 503 || status === 500 || msg.includes('unavailable') || msg.includes('overloaded')) {
      return {
        code: 'PROVIDER_UNAVAILABLE',
        message: 'Google Gemini service is temporarily unavailable. Please retry shortly.',
        retryable: true,
      };
    }

    return {
      code: 'PROVIDER_ERROR',
      message: err?.message || 'An unexpected error occurred while communicating with Google Gemini.',
      retryable: true,
    };
  }

  /**
   * Stream explanation from Google Gemini.
   *
   * @param {Object} options
   * @param {string} options.selectedText
   * @param {string} [options.surroundingContext]
   * @param {string} [options.surroundingSentence]
   * @param {string} [options.pageTitle]
   * @param {string} [options.pageUrl]
   * @param {string} [options.contentType]
   * @param {string} [options.selectionType]
   * @param {string} [options.explanationLevel]
   * @param {string} [options.model]
   * @param {(text: string) => void} onDelta - Callback invoked per text delta
   * @param {AbortSignal} [signal] - Optional cancellation signal
   * @returns {Promise<{ usage: Object|null }>}
   */
  async streamExplanation(options, onDelta, signal) {
    if (!this.isAvailable()) {
      throw this.normalizeError(new Error('API key not configured'), 401);
    }

    const activeModel = options.model || this.model;
    const systemPrompt = buildSystemPrompt(options);
    const userPrompt = buildUserPrompt(options);

    const endpoint = `${this.baseUrl}/${activeModel}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    };

    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal,
      });
    } catch (fetchErr) {
      throw this.normalizeError(fetchErr);
    }

    if (!response.ok) {
      let errBody = '';
      try {
        errBody = await response.text();
      } catch (_e) {}
      throw this.normalizeError(new Error(errBody || response.statusText), response.status);
    }

    if (!response.body) {
      throw new Error('Google Gemini returned an empty response body.');
    }

    let usage = null;

    await parseSSEStream(
      response.body,
      ({ data }) => {
        if (!data || typeof data !== 'object') return;

        // Capture usage metadata if provided
        if (data.usageMetadata) {
          usage = {
            inputTokens: data.usageMetadata.promptTokenCount || 0,
            outputTokens: data.usageMetadata.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata.totalTokenCount || 0,
          };
        }

        // Extract text parts
        const candidates = data.candidates || [];
        for (const candidate of candidates) {
          const parts = candidate.content?.parts || [];
          for (const part of parts) {
            if (part.text) {
              onDelta(part.text);
            }
          }
        }
      },
      signal
    );

    return { usage };
  }

  /**
   * Stream follow-up conversational question from Google Gemini.
   *
   * @param {Object} options
   * @param {string} options.selectedText
   * @param {string} [options.surroundingContext]
   * @param {string} [options.previousExplanation]
   * @param {Array<{ role: string, content: string }>} [options.conversationHistory]
   * @param {string} options.question
   * @param {string} [options.explanationLevel]
   * @param {string} [options.model]
   * @param {(text: string) => void} onDelta
   * @param {AbortSignal} [signal]
   * @returns {Promise<{ usage: Object|null }>}
   */
  async streamFollowUp(options, onDelta, signal) {
    if (!this.isAvailable()) {
      throw this.normalizeError(new Error('API key not configured'), 401);
    }

    const activeModel = options.model || this.model;
    const systemPrompt = buildSystemPrompt(options);
    const userPrompt = buildFollowUpUserPrompt(options);

    const contents = [];

    // Add recent conversation history if provided (capped at last 6 turns)
    const history = (options.conversationHistory || []).slice(-6);
    for (const msg of history) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    // Add current follow-up prompt
    contents.push({
      role: 'user',
      parts: [{ text: userPrompt }],
    });

    const endpoint = `${this.baseUrl}/${activeModel}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1536,
      },
    };

    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal,
      });
    } catch (fetchErr) {
      throw this.normalizeError(fetchErr);
    }

    if (!response.ok) {
      let errBody = '';
      try {
        errBody = await response.text();
      } catch (_e) {}
      throw this.normalizeError(new Error(errBody || response.statusText), response.status);
    }

    let usage = null;

    await parseSSEStream(
      response.body,
      ({ data }) => {
        if (!data || typeof data !== 'object') return;

        if (data.usageMetadata) {
          usage = {
            inputTokens: data.usageMetadata.promptTokenCount || 0,
            outputTokens: data.usageMetadata.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata.totalTokenCount || 0,
          };
        }

        const candidates = data.candidates || [];
        for (const candidate of candidates) {
          const parts = candidate.content?.parts || [];
          for (const part of parts) {
            if (part.text) {
              onDelta(part.text);
            }
          }
        }
      },
      signal
    );

    return { usage };
  }
}

export default GeminiProvider;

