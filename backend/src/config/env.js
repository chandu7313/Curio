/**
 * Curio Backend — Environment & Configuration Manager
 *
 * Validates and exposes server-side configuration using Zod.
 * Never exposes secrets to frontend clients or logs.
 *
 * @module backend/config/env
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// Load .env using native Node.js capabilities
function loadEnv() {
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile();
      return;
    } catch {
      // Continue to path fallback
    }
  }

  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), 'backend', '.env'),
      path.resolve(currentDir, '..', '..', '.env'),
    ];
    for (const envPath of candidates) {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
            if (process.env[key] === undefined) {
              process.env[key] = val;
            }
          }
        }
        break;
      }
    }
  } catch {
    // Non-blocking fallback
  }
}

loadEnv();

const EnvSchema = z.object({
  PORT: z
    .string()
    .default('5000')
    .transform((val) => parseInt(val, 10)),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  DEFAULT_AI_PROVIDER: z
    .enum(['gemini', 'groq'])
    .default('gemini'),
  ENABLE_PROVIDER_FAILOVER: z
    .string()
    .default('true')
    .transform((val) => val === 'true' || val === '1'),

  // Google Gemini API
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default('gemini-3.5-flash'),

  // Groq API
  GROQ_API_KEY: z.string().default(''),
  GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),

  // Database (Optional for explanation, required for cloud sync)
  DATABASE_URL: z.string().default(''),
  DB_POOL_MAX: z
    .string()
    .default('20')
    .transform((val) => parseInt(val, 10)),

  // CORS Origins
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:3000,http://localhost:5000'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .default('900000')
    .transform((val) => parseInt(val, 10)),
  RATE_LIMIT_MAX: z
    .string()
    .default('120')
    .transform((val) => parseInt(val, 10)),
});

/**
 * Parsed and validated configuration singleton.
 */
export const config = EnvSchema.parse(process.env);

/**
 * Validate AI provider setup and print informative startup summary.
 * Masks all secrets.
 *
 * @returns {{ geminiReady: boolean, groqReady: boolean, defaultProvider: string }}
 */
export function validateAiConfig() {
  const geminiReady = Boolean(config.GEMINI_API_KEY && config.GEMINI_API_KEY.trim().length > 0 && config.GEMINI_API_KEY !== 'your_gemini_api_key_here');
  const groqReady = Boolean(config.GROQ_API_KEY && config.GROQ_API_KEY.trim().length > 0 && config.GROQ_API_KEY !== 'your_groq_api_key_here');

  return {
    geminiReady,
    groqReady,
    defaultProvider: config.DEFAULT_AI_PROVIDER,
    failoverEnabled: config.ENABLE_PROVIDER_FAILOVER,
    geminiModel: config.GEMINI_MODEL,
    groqModel: config.GROQ_MODEL,
  };
}

export default config;
