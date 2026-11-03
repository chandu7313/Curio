/**
 * Curio Backend — Groq AI Provider
 *
 * Implements ultra-fast real-time streaming via Groq's official
 * OpenAI-compatible completions API endpoint.
 *
 * Models:
 *   - `llama-3.3-70b-versatile` (Default flagship)
 *   - `llama-3.1-8b-instant` (Fast lightweight alternative)
 *
 * Features:
 *   - Native fetch HTTP streaming (zero SDK baggage)
 *   - AbortSignal support
 *   - Standardized error mapping
 *   - Token usage parsing from x-groq or final chunk
 *
 * @module backend/services/ai/providers/groqProvider
 */

import { parseSSEStream } from '../../../utils/sse.js';
import { buildSystemPrompt, buildUserPrompt, buildFollowUpUserPrompt } from '../promptBuilder.js';
import { config } from '../../../config/env.js';

export class GroqProvider {
  /**
   * @param {Object} [options]
   * @param {string} [options.apiKey]
   * @param {string} [options.model]
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey !== undefined ? options.apiKey : config.GROQ_API_KEY;
    this.model = options.model || config.GROQ_MODEL || 'llama-3.3-70b-versatile';
    this.endpoint = 'https://api.groq.com/openai/v1/chat/completions';
  }

  get name() {
    return 'groq';
  }

  /**
   * Check if Groq API key is present.
   * @returns {boolean}
   */
  isAvailable() {
    return Boolean(
      this.apiKey &&
      typeof this.apiKey === 'string' &&
      this.apiKey.trim().length > 0 &&
      this.apiKey !== 'your_groq_api_key_here'
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

    if (status === 401 || msg.includes('invalid api key') || msg.includes('authentication') || msg.includes('unauthorized')) {
      return {
        code: 'AUTHENTICATION_ERROR',
        message: 'Invalid or missing Groq API key. Please check your backend configuration.',
        retryable: false,
      };
    }

    if (status === 429 || msg.includes('rate_limit_exceeded') || msg.includes('tokens per minute') || msg.includes('requests per minute')) {
      return {
        code: 'RATE_LIMITED',
        message: 'Groq rate limit exceeded. Please wait a few seconds before trying again.',
        retryable: true,
      };
    }

    if (status === 400 || msg.includes('invalid_request_error') || msg.includes('model_not_found')) {
      return {
        code: 'INVALID_REQUEST',
        message: 'Groq rejected the request or the specified model is invalid.',
        retryable: false,
      };
    }

    if (status === 503 || status === 500 || msg.includes('service_unavailable') || msg.includes('overloaded')) {
      return {
        code: 'PROVIDER_UNAVAILABLE',
        message: 'Groq service is temporarily overloaded or unavailable. Please retry shortly.',
        retryable: true,
      };
    }

    return {
      code: 'PROVIDER_ERROR',
      message: err?.message || 'An error occurred while communicating with the Groq API.',
      retryable: true,
    };
  }

  /**
   * Stream explanation from Groq.
   *
   * @param {Object} options
   * @param {(text: string) => void} onDelta
   * @param {AbortSignal} [signal]
   * @returns {Promise<{ usage: Object|null }>}
   */
  async streamExplanation(options, onDelta, signal) {
    if (!this.isAvailable()) {
      throw this.normalizeError(new Error('Groq API key not configured'), 401);
    }

    const activeModel = options.model || this.model;
    const systemPrompt = buildSystemPrompt(options);
    const userPrompt = buildUserPrompt(options);

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const requestBody = {
      model: activeModel,
      messages,
      temperature: 0.3,
      max_tokens: 2048,
      stream: true,
    };

    let response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
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
      throw new Error('Groq returned an empty response body.');
    }

    let usage = null;

    await parseSSEStream(
      response.body,
      ({ data, rawData }) => {
        if (rawData === '[DONE]') return;
        if (!data || typeof data !== 'object') return;

        // Capture usage from chunk if present
        if (data.usage) {
          usage = {
            inputTokens: data.usage.prompt_tokens || 0,
            outputTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0,
          };
        }

        const choices = data.choices || [];
        for (const choice of choices) {
          const delta = choice.delta?.content;
          if (delta) {
            onDelta(delta);
          }
        }
      },
      signal
    );

    return { usage };
  }

  /**
   * Stream follow-up conversational question from Groq.
   *
   * @param {Object} options
   * @param {(text: string) => void} onDelta
   * @param {AbortSignal} [signal]
   * @returns {Promise<{ usage: Object|null }>}
   */
  async streamFollowUp(options, onDelta, signal) {
    if (!this.isAvailable()) {
      throw this.normalizeError(new Error('Groq API key not configured'), 401);
    }

    const activeModel = options.model || this.model;
    const systemPrompt = buildSystemPrompt(options);
    const userPrompt = buildFollowUpUserPrompt(options);

    const messages = [{ role: 'system', content: systemPrompt }];

    // Append bounded conversation history
    const history = (options.conversationHistory || []).slice(-6);
    for (const msg of history) {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      });
    }

    messages.push({ role: 'user', content: userPrompt });

    const requestBody = {
      model: activeModel,
      messages,
      temperature: 0.3,
      max_tokens: 1536,
      stream: true,
    };

    let response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
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
      ({ data, rawData }) => {
        if (rawData === '[DONE]') return;
        if (!data || typeof data !== 'object') return;

        if (data.usage) {
          usage = {
            inputTokens: data.usage.prompt_tokens || 0,
            outputTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0,
          };
        }

        const choices = data.choices || [];
        for (const choice of choices) {
          const delta = choice.delta?.content;
          if (delta) {
            onDelta(delta);
          }
        }
      },
      signal
    );

    return { usage };
  }
}

export default GroqProvider;

