/**
 * Curio — Content Script (Isolated World - Pure JavaScript)
 *
 * Main entry point for the content script injected into every web page.
 * Orchestrates:
 *   - Universal Selection Engine (multi-strategy capture)
 *   - Context Extraction Engine (semantic enrichment)
 *   - Shadow DOM toast feedback (fully isolated from host CSS)
 *   - Keyboard shortcut handling (Alt+Shift+E fallback)
 *   - Selection snapshot caching (survives focus loss from hotkeys)
 *   - Extension messaging (content script <-> service worker IPC)
 *
 * @module content/content-script
 */

import { DOM_CONTAINER_ID } from '../shared/constants/index.js';
import {
  captureSelectionWithFallback,
  updateSelectionSnapshot,
  clearSelectionSnapshot,
} from './selection/index.js';
import { extractContext } from './context/index.js';
import { mountCurioOverlay, unmountCurioOverlay } from './overlay/mount.jsx';

console.log('[Curio] Content script injected.');

// ─── Shadow DOM Toast UI ─────────────────────────────────────────────

let shadowRoot = null;
let toastTimeout = null;

/**
 * Initialize the Shadow DOM mount for isolated toast feedback.
 * The host element uses `all: initial` + max z-index so it cannot be
 * affected by any host page styles, and contributes zero layout.
 * @returns {ShadowRoot}
 */
function initializeShadowHost() {
  if (shadowRoot) return shadowRoot;

  let host = document.getElementById(DOM_CONTAINER_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = DOM_CONTAINER_ID;
    host.style.cssText =
      'all:initial;position:absolute;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
    document.documentElement.appendChild(host);
  }

  shadowRoot = host.shadowRoot || host.attachShadow({ mode: 'open' });
  shadowRoot.innerHTML = `
    <style>
      :host { all: initial; }
      .curio-toast {
        position: fixed; bottom: 24px; right: 24px;
        background: #0f172a; color: #f8fafc;
        padding: 12px 18px; border-radius: 10px;
        font: 500 13px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        box-shadow: 0 10px 25px -5px rgba(0,0,0,.4), 0 8px 10px -6px rgba(0,0,0,.2);
        border: 1px solid #334155;
        display: flex; align-items: center; gap: 10px;
        z-index: 2147483647;
        opacity: 0; transform: translateY(12px);
        transition: opacity .2s cubic-bezier(.16,1,.3,1), transform .2s cubic-bezier(.16,1,.3,1);
        pointer-events: none;
        max-width: 420px;
      }
      .curio-toast.visible { opacity: 1; transform: translateY(0); pointer-events: auto; }
      .curio-badge {
        background: #0d9488; color: #fff;
        font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em;
        padding: 2px 6px; border-radius: 4px; flex-shrink: 0;
      }
      .curio-text { color: #e2e8f0; }
      .curio-type {
        font-size: 10px; color: #94a3b8;
        border: 1px solid #475569; border-radius: 3px;
        padding: 1px 5px; flex-shrink: 0;
      }
    </style>
    <div id="curio-toast" class="curio-toast">
      <span class="curio-badge">Curio</span>
      <span id="curio-toast-msg" class="curio-text"></span>
      <span id="curio-toast-type" class="curio-type" style="display:none"></span>
    </div>
  `;

  return shadowRoot;
}

/**
 * Show a non-disruptive toast notification inside the Shadow DOM.
 * @param {string} message
 * @param {Object} [opts]
 * @param {number} [opts.duration] - Auto-dismiss ms (default 3000)
 * @param {string} [opts.type] - Content type badge ('code', 'math', etc.)
 */
function showToast(message, opts = {}) {
  const { duration = 3000, type = null } = opts;
  const root = initializeShadowHost();
  const toast = root.getElementById('curio-toast');
  const msgEl = root.getElementById('curio-toast-msg');
  const typeEl = root.getElementById('curio-toast-type');

  if (!toast || !msgEl || !typeEl) return;

  msgEl.textContent = message;

  if (type) {
    typeEl.textContent = type;
    typeEl.style.display = '';
  } else {
    typeEl.style.display = 'none';
  }

  toast.classList.add('visible');

  if (toastTimeout) window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => {
    toast.classList.remove('visible');
  }, duration);
}

// ─── Selection Snapshot Tracking ─────────────────────────────────────
// On pointerup and keyup, we cache the current selection so it is
// available even if a subsequent keyboard shortcut collapses it.

/**
 * Debounce helper — returns a function that delays invocation.
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

const debouncedSnapshotUpdate = debounce(() => {
  updateSelectionSnapshot();
}, 120);

// Passive listeners for selection changes across mouse, keyboard, and form input
document.addEventListener('pointerup', debouncedSnapshotUpdate, { passive: true, capture: true });
document.addEventListener('keyup', debouncedSnapshotUpdate, { passive: true, capture: true });
document.addEventListener('selectionchange', debouncedSnapshotUpdate, { passive: true });
document.addEventListener('input', debouncedSnapshotUpdate, { passive: true, capture: true });

// Clear snapshot when the user clicks without dragging (collapsed selection)
document.addEventListener(
  'click',
  () => {
    const sel = window.getSelection();
    if (sel && sel.isCollapsed) {
      clearSelectionSnapshot();
    }
  },
  { passive: true, capture: true }
);

// ─── Core Trigger Flow ───────────────────────────────────────────────

/**
 * Execute the full selection → context extraction → messaging pipeline.
 * Called when the user triggers Curio via shortcut, command, or context menu.
 * @param {string} [fallbackText] - Text provided by context menu if DOM selection collapsed
 */
function handleTriggerSelectionFlow(fallbackText = '') {
  // Step 1: Capture selection (with fallback to cached snapshot)
  let snapshot = captureSelectionWithFallback();

  // If DOM selection was cleared or collapsed by context menu click, use fallbackText
  const existingText = snapshot?.text || snapshot?.selectedText;
  if (!existingText && fallbackText && typeof fallbackText === 'string' && fallbackText.trim()) {
    const cleanText = fallbackText.trim();
    const fallbackRect = {
      top: Math.max(80, Math.round(window.innerHeight / 2 - 200)),
      bottom: Math.max(100, Math.round(window.innerHeight / 2 - 180)),
      left: Math.max(40, Math.round(window.innerWidth / 2 - 225)),
      right: Math.max(240, Math.round(window.innerWidth / 2 + 225)),
      width: 450,
      height: 20,
    };
    snapshot = {
      text: cleanText,
      selectedText: cleanText,
      selectionType: cleanText.includes('\n') ? 'paragraph' : 'word',
      contentType: 'general_text',
      rect: fallbackRect,
      selectionRect: fallbackRect,
      pageTitle: document.title || '',
      pageUrl: window.location.href,
      timestamp: Date.now(),
    };
  }

  const validText = snapshot?.text || snapshot?.selectedText;
  if (!snapshot || !validText) {
    showToast('Select text first, then trigger Curio.', { duration: 2500 });
    return;
  }

  // Step 2: Extract enriched context
  const context = extractContext(snapshot);

  // Step 3: Build the standardized message payload
  const payload = {
    selectedText: context.selectedText,
    surroundingSentence: context.surroundingSentence,
    surroundingParagraph: context.surroundingParagraph,
    pageTitle: context.pageTitle,
    pageUrl: context.pageUrl,
    contentType: context.contentType,
    selectionType: context.selectionType,
    selectionRect: context.selectionRect,
    timestamp: context.timestamp,

    // Backward-compatibility properties
    sentence: context.sentence,
    paragraph: context.paragraph,
    language: context.language,
    precedingText: context.precedingText,
    succeedingText: context.succeedingText,
    nearestHeading: context.nearestHeading,
    boundingBox: context.boundingBox,
    nodeType: context.contentType,
  };

  // Step 4: Mount in-situ Floating AI Interface
  mountCurioOverlay(payload);

  console.log('[Curio] Floating AI interface mounted:', {
    contentType: payload.contentType,
    selectionType: payload.selectionType,
    language: payload.language,
    selectedLength: payload.selectedText.length,
    hasHeading: Boolean(payload.nearestHeading),
  });

  // Step 5: Forward to background service worker
  try {
    chrome.runtime.sendMessage({
      type: 'SELECTION_CAPTURED',
      payload,
    });
  } catch (err) {
    console.warn('[Curio] Background connection lost:', err);
    showToast('Extension connection lost. Try refreshing the page.', { duration: 4000 });
  }
}

// ─── Extension Messaging ─────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'PING':
      sendResponse({
        success: true,
        data: { status: 'ready', url: window.location.href },
      });
      break;

    case 'TRIGGER_SELECTION_FLOW':
      handleTriggerSelectionFlow(message.selectionText);
      sendResponse({ success: true });
      break;

    case 'SHOW_TOAST':
      showToast(message.message);
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ success: false, error: 'Unhandled content script message' });
  }
  return false;
});

// ─── In-Content Keyboard Shortcut (Fallback) ─────────────────────────
// The primary shortcut is handled by chrome.commands at the browser level.
// This in-content listener is a fallback for pages where chrome.commands
// events may not propagate to the content script.

function onKeydownTrigger(event) {
  if (event.altKey && event.shiftKey && (event.key === 'e' || event.key === 'E')) {
    event.preventDefault();
    event.stopPropagation();
    handleTriggerSelectionFlow();
  }
}

window.addEventListener('keydown', onKeydownTrigger, { capture: true });
document.addEventListener('keydown', onKeydownTrigger, { capture: true });
document.addEventListener('curio:trigger', () => handleTriggerSelectionFlow(), { capture: true });
