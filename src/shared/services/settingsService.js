/**
 * Curio — Centralized Settings, Preferences & Personalization Engine
 *
 * Implements a unified settings system with:
 *  - Strict schema validation via Zod
 *  - Sensible defaults & corrupted data recovery
 *  - Model validation against allowed configurations
 *  - Real-time synchronization across extension components via storage events
 *  - Local-first persistence (chrome.storage.local / chrome.storage.sync / in-memory fallback)
 *  - Comprehensive privacy controls (data export, conversation reset, full erasure)
 *
 * @module shared/services/settingsService
 */

import { DEFAULT_SETTINGS, AppSettingsSchema } from '../types/index.js';
import { storageAdapter, getVaultConcepts, getVaultCollections, clearVaultData } from './vaultStorage.js';
import { getGlossary, clearLearningData } from './learningService.js';
import { getGraphEdges, clearGraphEdges } from './graphStorage.js';
import { getLearningGoals } from './learningGoalsService.js';

export const SETTINGS_STORAGE_KEY = 'curio_settings_v1';

/**
 * Allowed AI Models configuration by provider.
 * Arbitrary models are strictly rejected unless explicitly allowed.
 */
export const ALLOWED_MODELS = {
  gemini: ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  groq: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
};

// In-memory listener bus for real-time component synchronization
const changeListeners = new Set();

/**
 * Validate candidate settings object against schema and allowed model rules.
 * Automatically corrects invalid or unrecognized properties with defaults.
 *
 * @param {Object} candidate
 * @returns {import('../types/index.js').AppSettings}
 */
export function validateSettings(candidate = {}) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { ...DEFAULT_SETTINGS };
  }
  const parseResult = AppSettingsSchema.safeParse(candidate);
  const base = parseResult.success ? parseResult.data : { ...DEFAULT_SETTINGS };

  // If theme was invalid in candidate, ensure safe fallback to default
  if (candidate.theme && !['light', 'dark', 'system'].includes(candidate.theme)) {
    base.theme = DEFAULT_SETTINGS.theme;
  }

  // Clamp contextWindowSize if provided
  if (typeof candidate.contextWindowSize === 'number') {
    base.contextWindowSize = Math.max(100, Math.min(1000, candidate.contextWindowSize));
  }

  // Validate AI Provider
  const provider = (base.aiProvider === 'groq' ? 'groq' : 'gemini');
  base.aiProvider = provider;

  // Validate Model: Must be in allowed configuration for active provider
  const allowedForProvider = ALLOWED_MODELS[provider] || ALLOWED_MODELS.gemini;
  if (!allowedForProvider.includes(base.model)) {
    base.model = allowedForProvider[0];
  }

  // Ensure no API keys are ever stored or exposed in extension settings
  if ('apiKey' in base) {
    base.apiKey = '';
  }

  return base;
}

/**
 * Retrieve active Curio settings.
 * Recovers gracefully from missing or corrupted storage data.
 *
 * @returns {Promise<import('../types/index.js').AppSettings>}
 */
export async function getSettings() {
  try {
    const data = await storageAdapter.get([SETTINGS_STORAGE_KEY]);
    const stored = data[SETTINGS_STORAGE_KEY];
    if (!stored || typeof stored !== 'object') {
      return { ...DEFAULT_SETTINGS };
    }
    return validateSettings(stored);
  } catch (err) {
    console.warn('[Curio Settings] Error reading settings, using defaults:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Persist partial settings updates and notify all active subscribers.
 *
 * @param {Partial<import('../types/index.js').AppSettings>} partialUpdates
 * @returns {Promise<import('../types/index.js').AppSettings>} Updated valid settings
 */
export async function updateSettings(partialUpdates = {}) {
  const current = await getSettings();
  const merged = { ...current, ...partialUpdates };
  const validated = validateSettings(merged);

  await storageAdapter.set({ [SETTINGS_STORAGE_KEY]: validated });

  // Notify in-process fallback subscribers if chrome.storage.onChanged is not available
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
    for (const listener of changeListeners) {
      try {
        listener(validated);
      } catch (e) {
        console.warn('[Curio Settings] Listener notification failed:', e);
      }
    }
  }

  return validated;
}

/**
 * Reset all settings to factory defaults.
 *
 * @returns {Promise<import('../types/index.js').AppSettings>}
 */
export async function resetSettings() {
  const defaults = { ...DEFAULT_SETTINGS };
  await storageAdapter.set({ [SETTINGS_STORAGE_KEY]: defaults });

  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
    for (const listener of changeListeners) {
      try {
        listener(defaults);
      } catch (_) {}
    }
  }

  return defaults;
}

/**
 * Subscribe to settings changes in real time across components.
 * Listens to both chrome.storage.onChanged and local bus.
 *
 * @param {(settings: import('../types/index.js').AppSettings) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function subscribeToSettings(callback) {
  if (typeof callback !== 'function') return () => {};

  changeListeners.add(callback);

  // Chrome storage change listener for cross-context synchronization (popup, content script, options)
  let chromeListener = null;
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chromeListener = (changes, areaName) => {
      if (changes[SETTINGS_STORAGE_KEY]) {
        const newVal = validateSettings(changes[SETTINGS_STORAGE_KEY].newValue);
        callback(newVal);
      }
    };
    chrome.storage.onChanged.addListener(chromeListener);
  }

  return () => {
    changeListeners.delete(callback);
    if (chromeListener && typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.removeListener(chromeListener);
    }
  };
}

// ─── Privacy & Data Management ──────────────────────────────────────

/**
 * Export complete personal data (Settings, Vault, Collections, Glossary, Graph, Goals)
 * as a formatted JSON backup.
 *
 * @returns {Promise<string>}
 */
export async function exportAllPersonalData() {
  const [settings, concepts, collections, glossary, edges, goals] = await Promise.all([
    getSettings(),
    getVaultConcepts(),
    getVaultCollections(),
    getGlossary(),
    getGraphEdges(),
    getLearningGoals(),
  ]);

  const payload = {
    app: 'Curio Personal Learning Intelligence',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    stats: {
      totalConcepts: concepts.length,
      totalCollections: collections.length,
      totalGlossary: glossary.length,
      totalGraphEdges: edges.length,
      totalGoals: goals.length,
    },
    settings,
    concepts,
    collections,
    glossary,
    graphEdges: edges,
    learningGoals: goals,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Clear all personal data (Vault, Collections, Glossary, Graph, Goals)
 * and reset settings to default values.
 *
 * @returns {Promise<boolean>}
 */
export async function clearAllPersonalData() {
  await Promise.all([
    clearVaultData(),
    clearLearningData(),
    clearGraphEdges(),
    storageAdapter.remove([
      'curio_learning_goals_v1',
      'curio_active_session_v1',
      'curio_conversation_history_v1',
      'curio_active_session',
      'curio_conversation_history',
    ]),
  ]);

  await resetSettings();
  return true;
}

/**
 * Clear active conversation session memory and follow-up threads.
 *
 * @returns {Promise<boolean>}
 */
export async function clearConversationHistory() {
  await storageAdapter.remove([
    'curio_active_session_v1',
    'curio_conversation_history_v1',
    'curio_active_session',
    'curio_conversation_history',
  ]);
  return true;
}

/**
 * Clear saved explanations and collections from the Knowledge Vault.
 *
 * @returns {Promise<boolean>}
 */
export async function clearSavedExplanations() {
  await clearVaultData();
  return true;
}
