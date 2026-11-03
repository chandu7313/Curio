/**
 * Curio — Safe Typed Storage Layer (JavaScript ES Modules)
 *
 * Bridges settings storage with centralized settingsService.
 *
 * @module shared/utils/storage
 */

import { getSettings, updateSettings } from '../services/settingsService.js';
import { DEFAULT_SETTINGS } from '../types/index.js';

/**
 * Retrieve user settings.
 * @returns {Promise<import('../types/index.js').AppSettings>}
 */
export async function getStoredSettings() {
  try {
    return await getSettings();
  } catch (err) {
    console.warn('[Curio Storage] Read failed, returning defaults:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Persist user settings.
 * @param {Partial<import('../types/index.js').AppSettings>} newSettings
 * @returns {Promise<boolean>}
 */
export async function saveStoredSettings(newSettings) {
  try {
    await updateSettings(newSettings);
    return true;
  } catch (err) {
    console.warn('[Curio Storage] Save failed:', err);
    return false;
  }
}
