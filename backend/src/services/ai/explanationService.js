/**
 * Curio Backend — AI Explanation & Streaming Orchestration Service
 *
 * Coordinates request execution, pre-stream provider failover,
 * and Server-Sent Event (SSE) dispatching.
 *
 * Critical Failover Rule:
 *   If the primary provider fails before any delta has been sent,
 *   Curio seamlessly attempts failover to the secondary configured provider.
 *   Once streaming starts (deltaCount > 0), failover is forbidden to avoid
 *   concatenating two disjointed partial responses.
 *
 * @module backend/services/ai/explanationService
 */

import { randomUUID } from 'node:crypto';
import { aiProviderFactory } from './aiProviderFactory.js';
import { sendStart, sendDelta, sendDone, sendError } from '../../utils/sse.js';
import { logger } from '../../utils/logger.js';

export class ExplanationService {
  /**
   * Orchestrate progressive explanation generation over Server-Sent Events.
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
   * @param {string} [options.provider] - Desired provider ('gemini', 'groq')
   * @param {string} [options.model]
   * @param {import('express').Response} res - Express response
   * @param {AbortSignal} [signal] - Client disconnect signal
   */
  async streamExplanation(options, res, signal) {
    const requestId = `req_${randomUUID()}`;
    let primaryProvider = aiProviderFactory.getProvider(options.provider);
    let activeProvider = primaryProvider;

    let deltaCount = 0;
    let accumulatedText = '';

    logger.info(`Starting explanation stream [${requestId}] using provider: ${activeProvider.name}`);

    // Helper to run stream attempt
    const runStream = async (provider) => {
      sendStart(res, {
        requestId,
        provider: provider.name,
        model: options.model || provider.model,
      });

      const result = await provider.streamExplanation(
        options,
        (delta) => {
          deltaCount++;
          accumulatedText += delta;
          sendDelta(res, delta);
        },
        signal
      );

      sendDone(res, {
        requestId,
        provider: provider.name,
        model: options.model || provider.model,
        usage: result?.usage || null,
      });

      logger.info(`Completed explanation stream [${requestId}]. Total deltas: ${deltaCount}, chars: ${accumulatedText.length}`);
    };

    try {
      await runStream(activeProvider);
    } catch (err) {
      // If client aborted generation, do nothing further
      if (signal?.aborted) {
        logger.info(`Explanation stream [${requestId}] was cancelled by client.`);
        return;
      }

      logger.warn(`Primary provider [${activeProvider.name}] failed for [${requestId}]:`, err.message);

      // Pre-stream failover attempt: ONLY allowed if 0 deltas were emitted
      if (deltaCount === 0) {
        const fallbackProvider = aiProviderFactory.getFallbackProvider(activeProvider.name);
        if (fallbackProvider && fallbackProvider.isAvailable()) {
          logger.info(`Attempting pre-stream failover to secondary provider [${fallbackProvider.name}] for [${requestId}]`);
          try {
            activeProvider = fallbackProvider;
            await runStream(fallbackProvider);
            return;
          } catch (fallbackErr) {
            logger.error(`Fallback provider [${fallbackProvider.name}] also failed for [${requestId}]:`, fallbackErr.message);
            const normalized = fallbackProvider.normalizeError
              ? fallbackProvider.normalizeError(fallbackErr)
              : { code: 'PROVIDER_UNAVAILABLE', message: fallbackErr.message, retryable: true };
            sendError(res, normalized);
            return;
          }
        }
      }

      // No failover possible or error happened mid-stream
      const normalized = activeProvider.normalizeError
        ? activeProvider.normalizeError(err)
        : { code: 'PROVIDER_ERROR', message: err.message, retryable: true };

      sendError(res, normalized);
    }
  }

  /**
   * Orchestrate streaming response to a follow-up conversational question.
   *
   * @param {Object} options
   * @param {string} options.selectedText
   * @param {string} [options.surroundingContext]
   * @param {string} [options.previousExplanation]
   * @param {Array<{ role: string, content: string }>} [options.conversationHistory]
   * @param {string} options.question
   * @param {string} [options.explanationLevel]
   * @param {string} [options.provider]
   * @param {string} [options.model]
   * @param {import('express').Response} res
   * @param {AbortSignal} [signal]
   */
  async streamFollowUp(options, res, signal) {
    const requestId = `req_fu_${randomUUID()}`;
    let primaryProvider = aiProviderFactory.getProvider(options.provider);
    let activeProvider = primaryProvider;

    let deltaCount = 0;
    let accumulatedText = '';

    logger.info(`Starting follow-up stream [${requestId}] using provider: ${activeProvider.name}`);

    const runStream = async (provider) => {
      sendStart(res, {
        requestId,
        provider: provider.name,
        model: options.model || provider.model,
      });

      const result = await provider.streamFollowUp(
        options,
        (delta) => {
          deltaCount++;
          accumulatedText += delta;
          sendDelta(res, delta);
        },
        signal
      );

      sendDone(res, {
        requestId,
        provider: provider.name,
        model: options.model || provider.model,
        usage: result?.usage || null,
      });

      logger.info(`Completed follow-up stream [${requestId}]. Total deltas: ${deltaCount}`);
    };

    try {
      await runStream(activeProvider);
    } catch (err) {
      if (signal?.aborted) {
        logger.info(`Follow-up stream [${requestId}] was cancelled by client.`);
        return;
      }

      logger.warn(`Primary provider [${activeProvider.name}] failed for follow-up [${requestId}]:`, err.message);

      if (deltaCount === 0) {
        const fallbackProvider = aiProviderFactory.getFallbackProvider(activeProvider.name);
        if (fallbackProvider && fallbackProvider.isAvailable()) {
          logger.info(`Attempting pre-stream failover to secondary provider [${fallbackProvider.name}] for follow-up [${requestId}]`);
          try {
            activeProvider = fallbackProvider;
            await runStream(fallbackProvider);
            return;
          } catch (fallbackErr) {
            logger.error(`Fallback provider [${fallbackProvider.name}] also failed for follow-up:`, fallbackErr.message);
            const normalized = fallbackProvider.normalizeError
              ? fallbackProvider.normalizeError(fallbackErr)
              : { code: 'PROVIDER_UNAVAILABLE', message: fallbackErr.message, retryable: true };
            sendError(res, normalized);
            return;
          }
        }
      }

      const normalized = activeProvider.normalizeError
        ? activeProvider.normalizeError(err)
        : { code: 'PROVIDER_ERROR', message: err.message, retryable: true };

      sendError(res, normalized);
    }
  }
}

export const explanationService = new ExplanationService();
export default explanationService;

