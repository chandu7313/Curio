/**
 * Curio — Safe Typed Storage Layer (JavaScript ES Modules)
 * Manages chrome.storage.sync for preferences and chrome.storage.local for credentials
 */

import { DEFAULT_SETTINGS, AppSettingsSchema } from '../types/index.js';
import { STORAGE_KEYS } from '../constants/index.js';

/**
 * Retrieve user settings, merging sync preferences with local credentials
 * @returns {Promise<import('../types/index.js').AppSettings>}
 */
export async function getStoredSettings() {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      resolve({ ...DEFAULT_SETTINGS });
      return;
    }

    // Load general preferences from sync
    chrome.storage.sync.get([STORAGE_KEYS.SETTINGS], (syncResult) => {
      const syncSettings = syncResult[STORAGE_KEYS.SETTINGS] || {};

      // Load sensitive credentials from local storage
      chrome.storage.local.get(['curio_api_key'], (localResult) => {
        const apiKey = localResult['curio_api_key'] || '';

        const merged = {
          ...DEFAULT_SETTINGS,
          ...syncSettings,
          apiKey,
        };

        const parsed = AppSettingsSchema.safeParse(merged);
        resolve(parsed.success ? parsed.data : { ...DEFAULT_SETTINGS, apiKey });
      });
    });
  });
}

/**
 * Persist user settings to sync and local storage
 * @param {Partial<import('../types/index.js').AppSettings>} newSettings
 * @returns {Promise<boolean>}
 */
export async function saveStoredSettings(newSettings) {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      resolve(false);
      return;
    }

    const { apiKey, ...syncSafeSettings } = newSettings;

    // Save non-sensitive settings to sync
    chrome.storage.sync.get([STORAGE_KEYS.SETTINGS], (existingSync) => {
      const current = existingSync[STORAGE_KEYS.SETTINGS] || {};
      const updatedSync = { ...current, ...syncSafeSettings };

      chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: updatedSync }, () => {
        if (chrome.runtime.lastError) {
          console.error('[Curio Storage] Failed to save sync settings:', chrome.runtime.lastError);
          resolve(false);
          return;
        }

        // If apiKey was provided (even empty string), save securely to local storage
        if (apiKey !== undefined) {
          chrome.storage.local.set({ curio_api_key: apiKey }, () => {
            if (chrome.runtime.lastError) {
              console.error('[Curio Storage] Failed to save api key to local storage:', chrome.runtime.lastError);
              resolve(false);
              return;
            }
            resolve(true);
          });
        } else {
          resolve(true);
        }
      });
    });
  });
}

