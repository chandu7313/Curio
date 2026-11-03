/**
 * Curio — Client-Side AI Streaming Pipeline (Fetch + ReadableStream SSE)
 *
 * Consumes Server-Sent Events over HTTP POST requests from the Curio backend.
 * Handles:
 *   - Progressive incremental text updates (delta events)
 *   - Stream start, completion, and error lifecycle events
 *   - User cancellation via AbortController
 *   - Automatic backend port failover (5000 -> 3000)
 *   - Offline fallback to local contextual analyzer if backend is unreachable
 *
 * @module overlay/streamingClient
 */

import { fetchExplanationWithLatency, answerFollowUpQuestion } from './mockExplainer.js';

const PRIMARY_BACKEND_URL = 'http://localhost:3000';
const SECONDARY_BACKEND_URL = 'http://localhost:5000';

let activeBackendUrl = PRIMARY_BACKEND_URL;

/**
 * Determine the active backend API base URL with fast connectivity check.
 * @returns {Promise<string>}
 */
async function getBackendBaseUrl() {
  // If extension settings specify a custom URL, prefer it
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const stored = await chrome.storage.local.get(['curio_backend_url']);
      if (stored.curio_backend_url) {
        return stored.curio_backend_url;
      }
    }
  } catch (_e) {}

  return activeBackendUrl;
}

/**
 * Parse a raw text buffer into individual SSE events.
 * Handles multiline data and arbitrary network chunk boundaries.
 *
 * @param {string} buffer
 * @returns {{ events: Array<{ event: string, data: any }>, remaining: string }}
 */
export function parseSSEBuffer(buffer) {
  const parts = buffer.split(/\r?\n\r?\n/);
  const remaining = parts.pop() || '';
  const events = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    let eventName = 'message';
    const dataLines = [];

    const lines = trimmed.split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.substring(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.substring(5).trimStart());
      }
    }

    if (dataLines.length > 0) {
      const rawData = dataLines.join('\n');
      let data = rawData;
      try {
        data = JSON.parse(rawData);
      } catch (_e) {
        data = rawData;
      }
      events.push({ event: eventName, data });
    }
  }

  return { events, remaining };
}

/**
 * Request a streaming explanation from the Curio backend.
 *
 * @param {Object} context - Selected text and contextual metadata
 * @param {string} level - 'beginner' | 'intermediate' | 'advanced'
 * @param {Object} callbacks
 * @param {(data: { requestId: string, provider: string, model: string }) => void} callbacks.onStart
 * @param {(delta: string, fullText: string) => void} callbacks.onDelta
 * @param {(data: { requestId: string, provider: string, usage: Object }) => void} callbacks.onDone
 * @param {(err: { code: string, message: string, retryable: boolean }) => void} callbacks.onError
 * @param {AbortSignal} [signal] - Optional cancellation signal
 * @returns {Promise<void>}
 */
export async function streamExplanationFromBackend(context, level, callbacks, signal) {
  const { onStart, onDelta, onDone, onError } = callbacks;
  const baseUrl = await getBackendBaseUrl();

  const payload = {
    selectedText: context.selectedText,
    surroundingContext: context.paragraph || context.surroundingParagraph || '',
    surroundingSentence: context.sentence || context.surroundingSentence || '',
    pageTitle: context.pageTitle || context.pageMetadata?.title || '',
    pageUrl: context.pageUrl || context.pageMetadata?.url || '',
    contentType: context.contentType || 'general_text',
    selectionType: context.selectionType || 'word',
    explanationLevel: level || 'intermediate',
  };

  let response;
  let fullAccumulatedText = '';

  try {
    response = await fetch(`${baseUrl}/api/v1/explain/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (netErr) {
    // If connection refused on port 5000, try port 3000
    if (activeBackendUrl === PRIMARY_BACKEND_URL) {
      try {
        activeBackendUrl = SECONDARY_BACKEND_URL;
        response = await fetch(`${SECONDARY_BACKEND_URL}/api/v1/explain/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal,
        });
      } catch (_retryErr) {
        // Both ports offline: fallback gracefully to local contextual analyzer
        console.info('[Curio] Backend server unreachable; using local intelligence fallback.');
        return fallbackToLocalExplanation(context, level, callbacks);
      }
    } else {
      return fallbackToLocalExplanation(context, level, callbacks);
    }
  }

  if (!response.ok || !response.body) {
    let errCode = 'SERVER_ERROR';
    let errMsg = `Server returned status ${response.status}`;
    try {
      const errJson = await response.json();
      errMsg = errJson.error || errMsg;
      errCode = errJson.code || errCode;
    } catch (_e) {}

    onError({
      code: errCode,
      message: errMsg,
      retryable: response.status >= 500,
    });
    return;
  }

  // Consume SSE stream chunk by chunk
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const { events, remaining } = parseSSEBuffer(buffer);
      buffer = remaining;

      for (const ev of events) {
        switch (ev.event) {
          case 'start':
            if (onStart) onStart(ev.data);
            break;
          case 'delta':
            if (ev.data?.text) {
              fullAccumulatedText += ev.data.text;
              if (onDelta) onDelta(ev.data.text, fullAccumulatedText);
            }
            break;
          case 'done':
            if (onDone) onDone(ev.data);
            break;
          case 'error':
            if (onError) onError(ev.data);
            break;
          default:
            break;
        }
      }
    }
  } catch (streamErr) {
    if (signal?.aborted) {
      return; // Clean user cancellation
    }
    onError({
      code: 'STREAM_READ_ERROR',
      message: streamErr.message || 'Stream interrupted.',
      retryable: true,
    });
  } finally {
    reader.releaseLock();
  }
}

/**
 * Request streaming response to a follow-up question.
 *
 * @param {Object} options
 * @param {string} options.question
 * @param {Object} options.context
 * @param {string} [options.previousExplanation]
 * @param {Array<Object>} [options.conversationHistory]
 * @param {string} options.level
 * @param {Object} callbacks
 * @param {AbortSignal} [signal]
 */
export async function streamFollowUpFromBackend(options, callbacks, signal) {
  const { onStart, onDelta, onDone, onError } = callbacks;
  const baseUrl = await getBackendBaseUrl();

  const payload = {
    selectedText: options.context.selectedText,
    surroundingContext: options.context.paragraph || options.context.surroundingParagraph || '',
    previousExplanation: options.previousExplanation || '',
    conversationHistory: (options.conversationHistory || []).map((msg) => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text,
    })),
    question: options.question,
    explanationLevel: options.level || 'intermediate',
  };

  let response;
  let fullAccumulatedText = '';

  try {
    response = await fetch(`${baseUrl}/api/v1/explain/follow-up/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (_e) {
    // Offline fallback for follow-up
    const mockAns = await answerFollowUpQuestion(options.question, options.context);
    if (onStart) onStart({ requestId: 'mock_fu', provider: 'local' });
    if (onDelta) onDelta(mockAns.answer, mockAns.answer);
    if (onDone) onDone({ requestId: 'mock_fu', provider: 'local' });
    return;
  }

  if (!response.ok || !response.body) {
    onError({ code: 'SERVER_ERROR', message: `Server error ${response.status}`, retryable: true });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        break;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const { events, remaining } = parseSSEBuffer(buffer);
      buffer = remaining;

      for (const ev of events) {
        if (ev.event === 'start' && onStart) onStart(ev.data);
        if (ev.event === 'delta' && ev.data?.text) {
          fullAccumulatedText += ev.data.text;
          if (onDelta) onDelta(ev.data.text, fullAccumulatedText);
        }
        if (ev.event === 'done' && onDone) onDone(ev.data);
        if (ev.event === 'error' && onError) onError(ev.data);
      }
    }
  } catch (err) {
    if (!signal?.aborted && onError) {
      onError({ code: 'STREAM_ERROR', message: err.message, retryable: true });
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Fallback to local offline explainer when the backend is offline.
 * Simulates brief streaming chunks so the UI remains dynamic.
 */
async function fallbackToLocalExplanation(context, level, callbacks) {
  const { onStart, onDelta, onDone } = callbacks;

  const mock = await fetchExplanationWithLatency(context, level);

  if (onStart) {
    onStart({ requestId: 'local_fallback', provider: 'local-offline', model: 'curio-heuristic' });
  }

  // Format mock as clean markdown
  const markdownChunks = [
    `### ${mock.title}\n\n`,
    `${mock.summary}\n\n`,
    `### Key Insights\n`,
    ...mock.keyPoints.map((pt) => `- ${pt}\n`),
    mock.codeExample ? `\n\`\`\`${mock.codeExample.language || 'javascript'}\n${mock.codeExample.code}\n\`\`\`\n` : '',
    mock.deepDive ? `\n> **Internal Mechanics:** ${mock.deepDive}\n` : '',
  ];

  let accumulated = '';
  for (const chunk of markdownChunks) {
    accumulated += chunk;
    if (onDelta) onDelta(chunk, accumulated);
    await new Promise((r) => setTimeout(r, 40));
  }

  if (onDone) {
    onDone({ requestId: 'local_fallback', provider: 'local-offline', usage: null });
  }
}

