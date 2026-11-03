/**
 * Curio Backend — Health Check Controller
 *
 * Provides service operational status and provider connectivity indicators
 * without exposing sensitive configuration, tokens, or environment secrets.
 *
 * @module backend/controllers/healthController
 */

import { checkDbHealth } from '../db.js';
import { validateAiConfig } from '../config/env.js';

export const healthController = {
  /**
   * GET /api/v1/health & GET /health
   */
  async getHealth(req, res) {
    let dbConnected = false;
    try {
      dbConnected = await checkDbHealth();
    } catch (_e) {
      dbConnected = false;
    }

    const aiStatus = validateAiConfig();
    const hasAnyProvider = aiStatus.geminiReady || aiStatus.groqReady;

    const isHealthy = hasAnyProvider || dbConnected;

    res.status(200).json({
      status: isHealthy ? 'healthy' : 'degraded',
      version: '1.0.0',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      services: {
        database: dbConnected ? 'connected' : 'disconnected',
        aiProviders: {
          default: aiStatus.defaultProvider,
          gemini: aiStatus.geminiReady ? 'ready' : 'unconfigured',
          groq: aiStatus.groqReady ? 'ready' : 'unconfigured',
          failoverEnabled: aiStatus.failoverEnabled,
        },
      },
    });
  },
};

export default healthController;
