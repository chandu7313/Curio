/**
 * Curio Backend — Streaming Connection & Lifecycle Controller
 *
 * Manages HTTP SSE connection headers, lifecycle events, and client abort
 * propagation so that disconnected tabs cleanly cancel upstream LLM requests.
 *
 * @module backend/services/ai/streamingService
 */

import { initSSE } from '../../utils/sse.js';
import { logger } from '../../utils/logger.js';

export class StreamingService {
  /**
   * Set up an HTTP streaming session with automatic client abort detection.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @returns {{ abortController: AbortController, signal: AbortSignal }}
   */
  createStreamSession(req, res) {
    initSSE(res);

    const abortController = new AbortController();
    const { signal } = abortController;

    // Detect when client closes connection or navigates away
    req.on('close', () => {
      if (!res.writableEnded) {
        logger.info('[Curio Stream] Client disconnected prematurely. Aborting upstream generation.');
        abortController.abort();
      }
    });

    return { abortController, signal };
  }
}

export const streamingService = new StreamingService();
export default streamingService;

