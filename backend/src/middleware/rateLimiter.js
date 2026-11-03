/**
 * Curio Backend — Rate Limiting Middleware
 *
 * Protects backend from DDoS and LLM API cost overruns.
 *
 * @module backend/middleware/rateLimiter
 */

import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

/**
 * Standard API rate limiter.
 */
export const standardApiLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
    code: 'RATE_LIMITED',
  },
});

/**
 * Dedicated rate limiter for AI streaming endpoints.
 * Slightly tighter to prevent automated LLM quota exhaustion.
 */
export const aiStreamLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 explanations per minute per client
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'AI explanation rate limit reached. Please wait a few moments before requesting another explanation.',
    code: 'RATE_LIMITED',
  },
});

