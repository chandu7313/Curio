/**
 * Curio Backend — AI Explanation Stream Controller
 *
 * Handles HTTP requests for real-time streaming explanations and
 * follow-up conversational answers.
 *
 * @module backend/controllers/explainController
 */

import { streamingService } from '../services/ai/streamingService.js';
import { explanationService } from '../services/ai/explanationService.js';

export const explainController = {
  /**
   * POST /api/v1/explain/stream
   */
  async streamExplanation(req, res, next) {
    try {
      const payload = req.validatedBody || req.body;
      const { signal } = streamingService.createStreamSession(req, res);

      await explanationService.streamExplanation(payload, res, signal);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/explain/follow-up/stream
   */
  async streamFollowUp(req, res, next) {
    try {
      const payload = req.validatedBody || req.body;
      const { signal } = streamingService.createStreamSession(req, res);

      await explanationService.streamFollowUp(payload, res, signal);
    } catch (err) {
      next(err);
    }
  },
};

export default explainController;

