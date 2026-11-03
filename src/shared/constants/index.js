/**
 * Curio — Shared Constants (JavaScript)
 */

export const APP_NAME = 'Curio';
export const APP_VERSION = '1.0.0';

export const STORAGE_KEYS = Object.freeze({
  SETTINGS: 'curio_settings_v1',
  HISTORY: 'curio_history_v1',
  SESSION: 'curio_session_v1',
});

export const COMMAND_NAMES = Object.freeze({
  TRIGGER_CURIO: 'trigger-curio',
});

export const DEFAULT_SHORTCUT = 'Alt+Shift+E';

export const PORT_NAMES = Object.freeze({
  STREAM: 'curio-stream',
});

export const DOM_CONTAINER_ID = 'curio-host-container';
export const SHADOW_ROOT_ID = 'curio-shadow-root';

export const RESTRICTED_URL_PREFIXES = Object.freeze([
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'view-source:',
  'https://chrome.google.com/webstore',
  'https://chromewebstore.google.com',
]);

