/**
 * Curio — Production Backend API Server Entrypoint
 *
 * Bootstraps Express server, performs environment check, and attaches
 * graceful shutdown listeners.
 *
 * @module backend/server
 */

import http from 'node:http';
import { app } from './app.js';
import { config, validateAiConfig } from './config/env.js';
import { logger } from './utils/logger.js';

let activeServer = null;

function startServer(targetPort, fallbackPort = null) {
  const server = http.createServer(app);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(`Port ${targetPort} is already in use (on macOS, port 5000 is typically reserved by AirPlay Receiver).`);
      if (fallbackPort && fallbackPort !== targetPort) {
        logger.info(`Attempting automatic fallback to port ${fallbackPort}...`);
        startServer(fallbackPort, null);
      } else {
        logger.error(`Could not bind to port ${targetPort} and no fallback ports available.`);
        process.exit(1);
      }
    } else {
      logger.error('Unexpected server error:', err);
      process.exit(1);
    }
  });

  server.listen(targetPort, () => {
    activeServer = server;
    const aiStatus = validateAiConfig();

    logger.info(`🚀 Curio Production AI Backend Server running on port ${targetPort}`);
    logger.info(`🔒 Environment: ${config.NODE_ENV} | Extension CORS Active`);
    logger.info(`🤖 AI Providers Status:`);
    logger.info(`   • Gemini API: ${aiStatus.geminiReady ? `Ready (${aiStatus.geminiModel})` : 'Unconfigured (Add GEMINI_API_KEY in .env)'}`);
    logger.info(`   • Groq API:   ${aiStatus.groqReady ? `Ready (${aiStatus.groqModel})` : 'Unconfigured (Add GROQ_API_KEY in .env)'}`);
    logger.info(`   • Default:    ${aiStatus.defaultProvider}`);
    logger.info(`   • Failover:   ${aiStatus.failoverEnabled ? 'Enabled' : 'Disabled'}`);
    logger.info(`📡 Health Check: http://localhost:${targetPort}/api/v1/health`);
  });

  return server;
}

const requestedPort = config.PORT || 3000;
const secondaryPort = requestedPort === 5000 ? 3000 : (requestedPort === 3000 ? 5001 : 3000);

const server = startServer(requestedPort, secondaryPort);

// Graceful Shutdown Handlers
function handleShutdown(signal) {
  logger.info(`Received ${signal}. Gracefully shutting down HTTP server...`);
  if (activeServer) {
    activeServer.close(() => {
      logger.info('Closed remaining HTTP connections. Exiting process.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export default server;
