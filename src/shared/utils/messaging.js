/**
 * Curio — Resilient Messaging Utilities (JavaScript ES Modules)
 * Handles communication between background worker, content script, and UI pages
 */

/**
 * Send a typed message to the background service worker
 * @template T
 * @param {import('../types/index.js').ExtensionMessage} message
 * @returns {Promise<import('../types/index.js').MessageResponse>}
 */
export async function sendToBackground(message) {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      resolve({ success: false, error: 'Chrome runtime not available' });
      return;
    }

    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message || 'Background worker unreachable',
          });
          return;
        }
        resolve(response || { success: true });
      });
    } catch (err) {
      resolve({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown messaging exception',
      });
    }
  });
}

/**
 * Send a typed message to a content script in a specific tab
 * Handles "Receiving end does not exist" gracefully
 * @template T
 * @param {number} tabId
 * @param {import('../types/index.js').ExtensionMessage} message
 * @returns {Promise<import('../types/index.js').MessageResponse>}
 */
export async function sendToContentScript(tabId, message) {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.sendMessage) {
      resolve({ success: false, error: 'Chrome tabs API not available' });
      return;
    }

    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          const errMsg = chrome.runtime.lastError.message || '';
          resolve({
            success: false,
            error: errMsg.includes('Receiving end does not exist')
              ? 'Content script not loaded on this page (try refreshing)'
              : errMsg,
          });
          return;
        }
        resolve(response || { success: true });
      });
    } catch (err) {
      resolve({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to dispatch to content script',
      });
    }
  });
}

/**
 * Query the currently active tab in the focused window
 * @returns {Promise<chrome.tabs.Tab | null>}
 */
export async function getActiveTab() {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) {
      resolve(null);
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError || !tabs || tabs.length === 0) {
        resolve(null);
        return;
      }
      resolve(tabs[0]);
    });
  });
}

