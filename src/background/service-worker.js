/**
 * Curio — Background Service Worker (Manifest V3 - Pure JavaScript ES Modules)
 * Orchestrates extension commands, tab communication, context menus, and settings persistence.
 */

import { COMMAND_NAMES, RESTRICTED_URL_PREFIXES } from '../shared/constants/index.js';
import { getStoredSettings, saveStoredSettings } from '../shared/utils/storage.js';
import { sendToContentScript } from '../shared/utils/messaging.js';

console.log('[Curio Service Worker] Initializing background worker (JS)...');

/**
 * Initialize default context menus
 */
function setupContextMenu() {
  try {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'curio-explain-selection',
        title: 'Explain with Curio ("%s")',
        contexts: ['selection'],
      });
    });
  } catch (err) {
    console.warn('[Curio Service Worker] Failed to register context menu:', err);
  }
}

/**
 * Handle Extension Installation / Update Lifecycle
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log(`[Curio Service Worker] Extension installed/updated: ${details.reason}`);
  setupContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  setupContextMenu();
});

/**
 * Handle Context Menu Clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'curio-explain-selection') {
    let tabId = tab?.id;
    if (!tabId) {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tabId = activeTab?.id;
    }
    if (tabId) {
      await handleTriggerSelection(tabId, 'context_menu', info.selectionText);
    }
  }
});

/**
 * Handle Native Chrome Commands (Shortcuts)
 * Registered in manifest.json commands as 'trigger-curio'
 */
chrome.commands.onCommand.addListener(async (command) => {
  console.log(`[Curio Service Worker] Command received: ${command}`);

  if (command === COMMAND_NAMES.TRIGGER_CURIO) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab?.id) {
      await handleTriggerSelection(activeTab.id, 'command_shortcut');
    }
  }
});

/**
 * Verify whether a URL is restricted by Chromium security policies
 * @param {string} [url]
 * @returns {boolean}
 */
function isRestrictedUrl(url) {
  if (!url) return true;
  return RESTRICTED_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

/**
 * Dispatch selection trigger to content script with fallback handling & dynamic injection
 * @param {number} tabId
 * @param {string} triggerSource
 * @param {string} [selectionText]
 */
async function handleTriggerSelection(tabId, triggerSource, selectionText = '') {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (isRestrictedUrl(tab.url)) {
      console.warn(`[Curio Service Worker] Cannot run on restricted URL: ${tab.url}`);
      return;
    }

    let response = await sendToContentScript(tabId, {
      type: 'TRIGGER_SELECTION_FLOW',
      selectionText,
    });

    // If content script was not loaded on this tab (e.g. opened before extension was loaded/reloaded),
    // dynamically inject the content script and retry immediately
    if (!response.success && chrome.scripting) {
      console.info(`[Curio Service Worker] Tab ${tabId} missing content script; dynamically injecting...`);
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content/content-script.js'],
        });
        await new Promise((r) => setTimeout(r, 100));
        response = await sendToContentScript(tabId, {
          type: 'TRIGGER_SELECTION_FLOW',
          selectionText,
        });
      } catch (injectErr) {
        console.warn(`[Curio Service Worker] Dynamic injection failed:`, injectErr);
      }
    }

    if (!response.success) {
      console.warn(
        `[Curio Service Worker] Content script not ready on tab ${tabId} (${triggerSource}):`,
        response.error
      );
    }
  } catch (err) {
    console.error(`[Curio Service Worker] Error dispatching to tab ${tabId}:`, err);
  }
}

/**
 * Handle Internal Extension Messaging
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Return true from listener to indicate asynchronous response
  const handleAsync = async () => {
    try {
      switch (message.type) {
        case 'PING': {
          sendResponse({
            success: true,
            data: {
              type: 'PONG',
              version: chrome.runtime.getManifest().version,
              isReady: true,
            },
          });
          break;
        }

        case 'GET_SETTINGS': {
          const settings = await getStoredSettings();
          sendResponse({ success: true, data: settings });
          break;
        }

        case 'SAVE_SETTINGS': {
          const success = await saveStoredSettings(message.payload);
          sendResponse({ success });
          break;
        }

        case 'GET_STATUS': {
          const manifest = chrome.runtime.getManifest();
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

          let contentScriptInjected = false;
          if (activeTab?.id && !isRestrictedUrl(activeTab.url)) {
            const pingResp = await sendToContentScript(activeTab.id, {
              type: 'PING',
              timestamp: Date.now(),
            });
            contentScriptInjected = pingResp.success;
          }

          const status = {
            version: manifest.version,
            manifestVersion: manifest.manifest_version,
            serviceWorkerActive: true,
            contentScriptInjected,
            tabId: activeTab?.id,
            tabUrl: activeTab?.url,
          };

          sendResponse({ success: true, data: status });
          break;
        }

        case 'TRIGGER_SELECTION_FLOW': {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (activeTab?.id) {
            await handleTriggerSelection(activeTab.id, 'popup_button');
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'No active tab found' });
          }
          break;
        }

        case 'OPEN_OPTIONS_PAGE': {
          chrome.runtime.openOptionsPage();
          sendResponse({ success: true });
          break;
        }

        case 'SELECTION_CAPTURED': {
          console.log(
            `[Curio Service Worker] Selection captured from tab ${sender.tab?.id} (length: ${message.payload.selectedText?.length || 0} chars, type: ${message.payload.contentType || 'prose'})`
          );
          sendResponse({ success: true });
          break;
        }

        default:
          sendResponse({ success: false, error: 'Unrecognized message type' });
      }
    } catch (err) {
      console.error('[Curio Service Worker] Message handling exception:', err);
      sendResponse({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown internal error',
      });
    }
  };

  handleAsync();
  return true; // Keep message channel open for async response
});

