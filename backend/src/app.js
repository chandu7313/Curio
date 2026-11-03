/**
 * Curio Backend — Express Application Setup
 *
 * Configures middleware, security policies, CORS origin whitelisting,
 * route mounting, and centralized error handling.
 *
 * @module backend/app
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { standardApiLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { config } from './config/env.js';

import healthRouter from './routes/health.js';
import explainRouter from './routes/explain.js';
import learningRouter from './routes/learning.js';

export const app = express();

// ─── 1. Security Headers ──────────────────────────────────────────────
app.use(helmet());

// ─── 2. CORS Policy ───────────────────────────────────────────────────
// Allow Chrome Extension origins and configured frontend URLs
const allowedOrigins = (config.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, extension service worker)
      if (!origin) return callback(null, true);

      // Allow all chrome-extension:// origins
      if (origin.startsWith('chrome-extension://')) {
        return callback(null, true);
      }

      // Allow whitelisted origins or localhost
      if (
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(origin) ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        return callback(null, true);
      }

      return callback(new Error('CORS request blocked by Curio security policy'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
    maxAge: 86400, // 24 hours preflight cache
  })
);

// ─── 3. Request Parsing ───────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ─── 4. Standard Rate Limiting ────────────────────────────────────────
app.use('/api/', standardApiLimiter);

// ─── 5. Route Mounting ────────────────────────────────────────────────
// Health endpoints
app.use('/health', healthRouter);
app.use('/api/v1/health', healthRouter);

// AI Explanation and Streaming routes
app.use('/api/v1/explain', explainRouter);

// Personal Learning & Sync routes
app.use('/api/v1/learning', learningRouter);

// ─── 6. Centralized Error Handling ────────────────────────────────────
app.use(errorHandler);

export default app;

