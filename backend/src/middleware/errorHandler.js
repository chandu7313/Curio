/**
 * Curio Backend — Centralized Error Handling Middleware
 *
 * Catches unhandled errors across routes and normalizes output.
 * Ensures zero internal stack leaks in production environments.
 *
 * @module backend/middleware/errorHandler
 */

import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

export function errorHandler(err, req, res, _next) {
  const isProd = config.NODE_ENV === 'production';
  const status = err.status || err.statusCode || 500;

  logger.error(`[HTTP ${status}] ${req.method} ${req.originalUrl}:`, err.message);

  res.status(status).json({
    success: false,
    code: err.code || 'INTERNAL_SERVER_ERROR',
    error: isProd && status === 500 ? 'Internal server error occurred.' : err.message,
    ...(isProd ? {} : { stack: err.stack }),
  });
}

export default errorHandler;

