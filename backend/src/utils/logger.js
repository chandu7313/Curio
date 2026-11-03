/**
 * Curio Backend — Structured & PII-Conscious Logger
 *
 * Automatically redacts sensitive tokens, API keys, passwords,
 * and authorization headers before printing to stdout/stderr.
 *
 * @module backend/utils/logger
 */

/**
 * Patterns of sensitive substrings to mask.
 */
const SENSITIVE_PATTERNS = [
  /AIza[0-9A-Za-z-_]{35}/g,                  // Google API keys
  /gsk_[0-9A-Za-z]{40,}/g,                   // Groq API keys
  /sk-[0-9A-Za-z]{32,}/g,                    // OpenAI / Generic API keys
  /Bearer\s+[A-Za-z0-9-_.]+/gi,              // Bearer tokens
  /password=["':\s]*([^"',\s]+)/gi,          // Passwords in strings
  /key=["':\s]*([A-Za-z0-9-_]{20,})/gi,      // API key fields
];

/**
 * Redact sensitive substrings from text or stringified arguments.
 * @param {string} text
 * @returns {string}
 */
export function redactSensitive(text) {
  if (typeof text !== 'string') return text;
  let cleaned = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[REDACTED]');
  }
  return cleaned;
}

/**
 * Format log arguments into a safe string.
 * @param {Array<any>} args
 * @returns {string}
 */
function formatArgs(args) {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return redactSensitive(arg);
      if (arg instanceof Error) {
        return redactSensitive(`${arg.message}\n${arg.stack || ''}`);
      }
      try {
        return redactSensitive(JSON.stringify(arg));
      } catch (_e) {
        return String(arg);
      }
    })
    .join(' ');
}

export const logger = {
  info(...args) {
    console.log(`[Curio INFO] [${new Date().toISOString()}] ${formatArgs(args)}`);
  },
  warn(...args) {
    console.warn(`[Curio WARN] [${new Date().toISOString()}] ${formatArgs(args)}`);
  },
  error(...args) {
    console.error(`[Curio ERROR] [${new Date().toISOString()}] ${formatArgs(args)}`);
  },
  debug(...args) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Curio DEBUG] [${new Date().toISOString()}] ${formatArgs(args)}`);
    }
  },
};

export default logger;

