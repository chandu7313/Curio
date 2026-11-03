/**
 * Curio Backend — AI Explanation Routes
 *
 * Exposes endpoints for real-time progressive streaming explanations
 * and conversational follow-up questions.
 *
 * @module backend/routes/explain
 */

import { Router } from 'express';
import { explainController } from '../controllers/explainController.js';
import { validateBody, ExplainStreamSchema, FollowUpStreamSchema } from '../middleware/validation.js';
import { aiStreamLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Apply AI rate limiter to stream endpoints
router.use(aiStreamLimiter);

/**
 * POST /api/v1/explain/stream
 * Progressive real-time streaming explanation via Server-Sent Events.
 */
router.post('/stream', validateBody(ExplainStreamSchema), explainController.streamExplanation);

/**
 * POST /api/v1/explain/follow-up/stream
 * Progressive follow-up conversational question stream.
 */
router.post('/follow-up/stream', validateBody(FollowUpStreamSchema), explainController.streamFollowUp);

export default router;

