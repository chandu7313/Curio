/**
 * Curio — Centralized Settings, Preferences & Personalization Test Suite
 *
 * Exhaustively validates:
 *   1. Saving preferences & schema defaults
 *   2. Restoring preferences & reset to factory defaults
 *   3. Theme customization (Dark, Light, System) & invalid theme handling
 *   4. AI Provider & Allowed Model validation (strict rejection of unauthorized models, zero API key exposure)
 *   5. Robust schema validation & boundary clamping (contextWindowSize, invalid enums)
 *   6. Storage failure resilience & memory fallback
 *   7. Cross-component live synchronization (chrome.storage.onChanged & subscriptions)
 *   8. Extension restart persistence simulation
 *   9. Personal data export (JSON backup of all user data)
 *  10. Personal data erasure (clearConversationHistory, clearSavedExplanations, clearAllPersonalData)
 *
 * Pure JavaScript (Node.js test runner: node:test + node:assert/strict).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  SETTINGS_STORAGE_KEY,
  ALLOWED_MODELS,
  validateSettings,
  getSettings,
  updateSettings,
  resetSettings,
  subscribeToSettings,
  exportAllPersonalData,
  clearAllPersonalData,
  clearConversationHistory,
  clearSavedExplanations,
} from '../../src/shared/services/settingsService.js';

import {
  storageAdapter,
  VAULT_CONCEPTS_KEY,
  VAULT_COLLECTIONS_KEY,
  getVaultConcepts,
  getVaultCollections,
} from '../../src/shared/services/vaultStorage.js';

import { getGlossary } from '../../src/shared/services/learningService.js';
import { getGraphEdges, GRAPH_EDGES_KEY } from '../../src/shared/services/graphStorage.js';
import { DEFAULT_SETTINGS } from '../../src/shared/types/index.js';

describe('Curio Settings — Centralized Preferences & Validation Engine', () => {
  let mockStorage = {};
  let storageChangeListeners = [];

  beforeEach(async () => {
    mockStorage = {};
    storageChangeListeners = [];

    // Mock chrome.storage.local and chrome.storage.onChanged
    globalThis.chrome = {
      storage: {
        local: {
          get: async (keys) => {
            const result = {};
            const keyList = Array.isArray(keys) ? keys : [keys];
            for (const k of keyList) {
              result[k] = mockStorage[k] !== undefined ? mockStorage[k] : undefined;
            }
            return result;
          },
          set: async (items) => {
            const changes = {};
            for (const [k, v] of Object.entries(items)) {
              changes[k] = { oldValue: mockStorage[k], newValue: v };
              mockStorage[k] = v;
            }
            for (const listener of storageChangeListeners) {
              listener(changes, 'local');
            }
          },
          remove: async (keys) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            const changes = {};
            for (const k of keyList) {
              changes[k] = { oldValue: mockStorage[k], newValue: undefined };
              delete mockStorage[k];
            }
            for (const listener of storageChangeListeners) {
              listener(changes, 'local');
            }
          },
          clear: async () => {
            mockStorage = {};
          },
        },
        onChanged: {
          addListener: (fn) => storageChangeListeners.push(fn),
          removeListener: (fn) => {
            storageChangeListeners = storageChangeListeners.filter((l) => l !== fn);
          },
        },
      },
    };

    await storageAdapter.clear();
  });

  // ─── 1. Saving Preferences & Default Fallbacks ────────────────────────
  describe('1. Default Settings & Saving Preferences', () => {
    it('should return factory defaults when storage is empty', async () => {
      const settings = await getSettings();
      assert.equal(settings.theme, DEFAULT_SETTINGS.theme);
      assert.equal(settings.aiProvider, 'gemini');
      assert.equal(settings.model, 'gemini-2.0-flash');
      assert.equal(settings.defaultLevel, 'intermediate');
      assert.equal(settings.windowBehavior, 'near_selection');
      assert.equal(settings.animationPreference, 'full');
      assert.equal(settings.cancellationBehavior, 'keep_partial');
      assert.equal(settings.saveHistory, true);
      assert.equal(settings.compactMode, false);
      assert.equal(settings.overlayWidth, 'standard');
      assert.equal(settings.fontSize, 'medium');
    });

    it('should save partial updates and preserve existing fields', async () => {
      const updated = await updateSettings({
        theme: 'light',
        overlayWidth: 'wide',
        fontSize: 'large',
      });

      assert.equal(updated.theme, 'light');
      assert.equal(updated.overlayWidth, 'wide');
      assert.equal(updated.fontSize, 'large');
      // Other fields remain intact
      assert.equal(updated.aiProvider, 'gemini');
      assert.equal(updated.saveHistory, true);

      // Verify written to storage
      assert.ok(mockStorage[SETTINGS_STORAGE_KEY]);
      assert.equal(mockStorage[SETTINGS_STORAGE_KEY].theme, 'light');
      assert.equal(mockStorage[SETTINGS_STORAGE_KEY].overlayWidth, 'wide');
    });
  });

  // ─── 2. Restoring Preferences & Factory Reset ─────────────────────────
  describe('2. Restoring Preferences & Factory Reset', () => {
    it('should restore previously saved preferences from storage', async () => {
      mockStorage[SETTINGS_STORAGE_KEY] = {
        theme: 'dark',
        language: 'es',
        defaultLevel: 'advanced',
        overlayWidth: 'compact',
        aiProvider: 'groq',
        model: 'llama-3.3-70b-versatile',
      };

      const restored = await getSettings();
      assert.equal(restored.theme, 'dark');
      assert.equal(restored.language, 'es');
      assert.equal(restored.defaultLevel, 'advanced');
      assert.equal(restored.overlayWidth, 'compact');
      assert.equal(restored.aiProvider, 'groq');
      assert.equal(restored.model, 'llama-3.3-70b-versatile');
    });

    it('should reset all settings back to factory defaults', async () => {
      await updateSettings({
        theme: 'light',
        overlayWidth: 'compact',
        compactMode: true,
      });

      const reset = await resetSettings();
      assert.equal(reset.theme, DEFAULT_SETTINGS.theme);
      assert.equal(reset.overlayWidth, DEFAULT_SETTINGS.overlayWidth);
      assert.equal(reset.compactMode, DEFAULT_SETTINGS.compactMode);

      const inStorage = await getSettings();
      assert.equal(inStorage.theme, DEFAULT_SETTINGS.theme);
      assert.equal(inStorage.compactMode, false);
    });
  });

  // ─── 3. Theme Customization ───────────────────────────────────────────
  describe('3. Theme Customization', () => {
    it('should permit valid theme options (dark, light, system)', async () => {
      for (const t of ['dark', 'light', 'system']) {
        const res = await updateSettings({ theme: t });
        assert.equal(res.theme, t);
      }
    });

    it('should reject invalid theme string and default safely', () => {
      const validated = validateSettings({ theme: 'neon-cyberpunk' });
      assert.equal(validated.theme, DEFAULT_SETTINGS.theme);
    });
  });

  // ─── 4. Provider & Allowed Model Validation (Security) ────────────────
  describe('4. AI Provider & Allowed Model Security Enforcement', () => {
    it('should allow valid Gemini models', async () => {
      for (const model of ALLOWED_MODELS.gemini) {
        const res = await updateSettings({ aiProvider: 'gemini', model });
        assert.equal(res.aiProvider, 'gemini');
        assert.equal(res.model, model);
      }
    });

    it('should allow valid Groq models', async () => {
      for (const model of ALLOWED_MODELS.groq) {
        const res = await updateSettings({ aiProvider: 'groq', model });
        assert.equal(res.aiProvider, 'groq');
        assert.equal(res.model, model);
      }
    });

    it('should REJECT arbitrary or unauthorized models and revert to provider default', () => {
      const maliciousPayload = {
        aiProvider: 'gemini',
        model: 'unauthorized-gpt-infinite-jailbreak',
      };
      const validated = validateSettings(maliciousPayload);
      assert.equal(validated.aiProvider, 'gemini');
      assert.equal(validated.model, ALLOWED_MODELS.gemini[0]); // Auto-reverted to default
    });

    it('should REJECT arbitrary model when provider is Groq', () => {
      const unapprovedPayload = {
        aiProvider: 'groq',
        model: 'random-huggingface-model-v1',
      };
      const validated = validateSettings(unapprovedPayload);
      assert.equal(validated.aiProvider, 'groq');
      assert.equal(validated.model, ALLOWED_MODELS.groq[0]);
    });

    it('should never expose or store API keys in settings', async () => {
      const payloadWithSecret = {
        theme: 'dark',
        apiKey: 'AIzaSySecretApiKey1234567890',
        secretToken: 'shhh-confidential',
      };

      const validated = validateSettings(payloadWithSecret);
      assert.equal(validated.apiKey, '');
      assert.equal(validated.secretToken, undefined);

      const saved = await updateSettings(payloadWithSecret);
      assert.equal(saved.apiKey, '');
      assert.equal(mockStorage[SETTINGS_STORAGE_KEY].apiKey, '');
    });
  });

  // ─── 5. Robust Schema Validation & Boundary Clamping ──────────────────
  describe('5. Robust Schema Validation & Boundaries', () => {
    it('should clamp contextWindowSize between 100 and 1000', () => {
      const tooSmall = validateSettings({ contextWindowSize: 20 });
      assert.equal(tooSmall.contextWindowSize, 100);

      const tooLarge = validateSettings({ contextWindowSize: 99999 });
      assert.equal(tooLarge.contextWindowSize, 1000);

      const valid = validateSettings({ contextWindowSize: 650 });
      assert.equal(valid.contextWindowSize, 650);
    });

    it('should reject invalid windowBehavior and default safely', () => {
      const invalid = validateSettings({ windowBehavior: 'fly_to_moon' });
      assert.equal(invalid.windowBehavior, 'near_selection');
    });

    it('should reject invalid animationPreference and default safely', () => {
      const invalid = validateSettings({ animationPreference: 'warp_speed' });
      assert.equal(invalid.animationPreference, 'full');
    });

    it('should reject invalid overlayWidth and default safely', () => {
      const invalid = validateSettings({ overlayWidth: 'colossal_fullscreen' });
      assert.equal(invalid.overlayWidth, 'standard');
    });

    it('should handle completely corrupt / non-object input without throwing', () => {
      assert.doesNotThrow(() => {
        const fromNull = validateSettings(null);
        assert.equal(fromNull.theme, DEFAULT_SETTINGS.theme);

        const fromString = validateSettings('corrupt_json_string');
        assert.equal(fromString.theme, DEFAULT_SETTINGS.theme);

        const fromArray = validateSettings([1, 2, 3]);
        assert.equal(fromArray.theme, DEFAULT_SETTINGS.theme);
      });
    });
  });

  // ─── 6. Storage Failure Resilience ────────────────────────────────────
  describe('6. Storage Failure Resilience', () => {
    it('should recover gracefully when chrome.storage.local.get fails', async () => {
      await storageAdapter.clear();
      globalThis.chrome.storage.local.get = async () => {
        throw new Error('Chrome storage quota exceeded or disk IO error');
      };

      const settings = await getSettings();
      assert.ok(settings);
      assert.equal(settings.theme, DEFAULT_SETTINGS.theme);
      assert.equal(settings.aiProvider, 'gemini');
    });

    it('should update in-memory cache even if chrome.storage.local.set fails', async () => {
      globalThis.chrome.storage.local.set = async () => {
        throw new Error('Storage write prohibited');
      };

      const updated = await updateSettings({ theme: 'light' });
      assert.equal(updated.theme, 'light');
    });
  });

  // ─── 7. Cross-Component Live Synchronization ──────────────────────────
  describe('7. Cross-Component Live Synchronization', () => {
    it('should notify subscribers when updateSettings is called', async () => {
      let notified = null;
      const unsubscribe = subscribeToSettings((newSettings) => {
        notified = newSettings;
      });

      await updateSettings({ theme: 'dark', compactMode: true });

      assert.ok(notified);
      assert.equal(notified.theme, 'dark');
      assert.equal(notified.compactMode, true);

      unsubscribe();
    });

    it('should notify subscribers when chrome.storage.onChanged fires externally', async () => {
      let externalNotified = null;
      const unsubscribe = subscribeToSettings((newSettings) => {
        externalNotified = newSettings;
      });

      // Simulate change arriving from background service worker or another tab
      for (const listener of storageChangeListeners) {
        listener(
          {
            [SETTINGS_STORAGE_KEY]: {
              oldValue: DEFAULT_SETTINGS,
              newValue: { ...DEFAULT_SETTINGS, theme: 'light', overlayWidth: 'wide' },
            },
          },
          'local'
        );
      }

      assert.ok(externalNotified);
      assert.equal(externalNotified.theme, 'light');
      assert.equal(externalNotified.overlayWidth, 'wide');

      unsubscribe();
    });

    it('should stop notifications after unsubscribe', async () => {
      let callCount = 0;
      const unsubscribe = subscribeToSettings(() => {
        callCount++;
      });

      await updateSettings({ theme: 'light' });
      assert.equal(callCount, 1);

      unsubscribe();

      await updateSettings({ theme: 'dark' });
      assert.equal(callCount, 1); // Not called again
    });
  });

  // ─── 8. Extension Restart Persistence Simulation ──────────────────────
  describe('8. Extension Restart Persistence Simulation', () => {
    it('should persist settings across simulated extension reload', async () => {
      // Step 1: User customizes preferences
      await updateSettings({
        theme: 'dark',
        language: 'fr',
        defaultLevel: 'advanced',
        overlayWidth: 'wide',
        cancellationBehavior: 'discard_cancelled',
      });

      // Step 2: Simulate complete restart (read back directly from storage)
      const persistedInStorage = mockStorage[SETTINGS_STORAGE_KEY];
      assert.ok(persistedInStorage);

      const restored = await getSettings();
      assert.equal(restored.theme, 'dark');
      assert.equal(restored.language, 'fr');
      assert.equal(restored.defaultLevel, 'advanced');
      assert.equal(restored.overlayWidth, 'wide');
      assert.equal(restored.cancellationBehavior, 'discard_cancelled');
    });
  });

  // ─── 9. Personal Data Export ──────────────────────────────────────────
  describe('9. Personal Data Export', () => {
    it('should aggregate settings, vault, and learning graph into exportable JSON', async () => {
      // Seed some data
      mockStorage[SETTINGS_STORAGE_KEY] = { ...DEFAULT_SETTINGS, theme: 'light' };
      mockStorage[VAULT_CONCEPTS_KEY] = [{ id: 'concept-1', title: 'React Hooks' }];
      mockStorage[VAULT_COLLECTIONS_KEY] = [{ id: 'col-1', name: 'Web Dev' }];
      mockStorage['curio_learning_glossary_v1'] = [{ id: 'g-1', term: 'Closure' }];

      const jsonStr = await exportAllPersonalData();
      assert.ok(typeof jsonStr === 'string');

      const parsed = JSON.parse(jsonStr);
      assert.equal(parsed.version, '1.0.0');
      assert.ok(parsed.exportedAt);
      assert.equal(parsed.settings.theme, 'light');
      assert.equal(parsed.concepts.length, 1);
      assert.equal(parsed.concepts[0].title, 'React Hooks');
      assert.equal(parsed.collections.length, 1);
      assert.equal(parsed.glossary.length, 1);
    });
  });

  // ─── 10. Personal Data Erasure & Privacy Controls ─────────────────────
  describe('10. Personal Data Erasure & Privacy Controls', () => {
    it('should clear active conversation history without affecting vault or settings', async () => {
      mockStorage['curio_active_session_v1'] = { sessionId: 'sess-123', messages: ['hello'] };
      mockStorage['curio_conversation_history_v1'] = [{ id: 'hist-1' }];
      mockStorage[SETTINGS_STORAGE_KEY] = { ...DEFAULT_SETTINGS, theme: 'light' };

      const cleared = await clearConversationHistory();
      assert.equal(cleared, true);

      assert.equal(mockStorage['curio_active_session_v1'], undefined);
      assert.equal(mockStorage['curio_conversation_history_v1'], undefined);
      // Settings remain intact
      assert.equal(mockStorage[SETTINGS_STORAGE_KEY].theme, 'light');
    });

    it('should clear saved vault concepts and collections', async () => {
      mockStorage[VAULT_CONCEPTS_KEY] = [{ id: 'concept-1' }];
      mockStorage[VAULT_COLLECTIONS_KEY] = [{ id: 'col-1' }];

      const cleared = await clearSavedExplanations();
      assert.equal(cleared, true);

      // Verify removed from storage or returns empty list
      assert.equal(mockStorage[VAULT_CONCEPTS_KEY], undefined);
      assert.equal(mockStorage[VAULT_COLLECTIONS_KEY], undefined);
      const concepts = await getVaultConcepts();
      assert.deepEqual(concepts, []);
    });

    it('should wipe all personal data and restore default settings on complete erasure', async () => {
      mockStorage[SETTINGS_STORAGE_KEY] = { theme: 'light', overlayWidth: 'wide' };
      mockStorage[VAULT_CONCEPTS_KEY] = [{ id: 'c1' }];
      mockStorage[VAULT_COLLECTIONS_KEY] = [{ id: 'col1' }];
      mockStorage['curio_learning_glossary_v1'] = [{ id: 'g1' }];
      mockStorage[GRAPH_EDGES_KEY] = [{ from: 'c1', to: 'c2' }];
      mockStorage['curio_learning_goals_v1'] = [{ id: 'goal1' }];

      const wiped = await clearAllPersonalData();
      assert.equal(wiped, true);

      // Verify all data stores empty/reset
      assert.equal(mockStorage[VAULT_CONCEPTS_KEY], undefined);
      assert.equal(mockStorage[VAULT_COLLECTIONS_KEY], undefined);
      assert.deepEqual(mockStorage['curio_learning_glossary_v1'], []);
      assert.equal(mockStorage[GRAPH_EDGES_KEY], undefined);
      assert.equal(mockStorage['curio_learning_goals_v1'], undefined);
      assert.equal(mockStorage[SETTINGS_STORAGE_KEY].theme, DEFAULT_SETTINGS.theme); // Reset to default
    });
  });
});
