/**
 * Curio — Isolated Shadow DOM Mount & React Lifecycle Controller
 *
 * Responsibilities:
 *  - Manages singleton `<curio-host>` custom element in the DOM
 *  - Attaches open ShadowRoot for total host-page CSS isolation
 *  - Injects compiled Tailwind & overlay styles into the Shadow DOM
 *  - Mounts & updates the React 19 FloatingOverlay component via createRoot
 *  - Handles cleanup and prevents memory leaks / duplicate overlays
 *
 * @module overlay/mount
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { FloatingOverlay } from './FloatingOverlay.jsx';
import overlayStyles from './overlay.css?inline';

const HOST_ELEMENT_TAG = 'curio-host';
const ROOT_CONTAINER_ID = 'curio-shadow-root';

/** @type {HTMLElement|null} */
let hostElement = null;

/** @type {ShadowRoot|null} */
let shadowRoot = null;

/** @type {import('react-dom/client').Root|null} */
let reactRoot = null;

/** @type {HTMLElement|null} */
let mountContainer = null;

/**
 * Initialize or retrieve the existing Shadow DOM host element.
 * @returns {ShadowRoot}
 */
function ensureShadowEnvironment() {
  if (shadowRoot && hostElement && document.contains(hostElement) && mountContainer) {
    return shadowRoot;
  }

  // If host was detached or missing, clean up any previous React root
  if (reactRoot) {
    try {
      reactRoot.unmount();
    } catch (_e) {}
    reactRoot = null;
  }

  // Check if an existing host exists from previous injection
  let existing = document.querySelector(HOST_ELEMENT_TAG);
  if (existing) {
    existing.remove();
  }

  // Create custom host element
  hostElement = document.createElement(HOST_ELEMENT_TAG);
  hostElement.style.all = 'initial';
  hostElement.style.display = 'block';
  hostElement.style.position = 'fixed';
  hostElement.style.top = '0';
  hostElement.style.left = '0';
  hostElement.style.width = '100vw';
  hostElement.style.height = '100vh';
  hostElement.style.zIndex = '2147483647';
  hostElement.style.pointerEvents = 'none';

  // Attach open shadow root
  shadowRoot = hostElement.attachShadow({ mode: 'open' });

  // Inject compiled Tailwind and component CSS
  const styleEl = document.createElement('style');
  styleEl.textContent = overlayStyles;
  shadowRoot.appendChild(styleEl);

  // Create mount node for React
  mountContainer = document.createElement('div');
  mountContainer.id = ROOT_CONTAINER_ID;
  mountContainer.style.width = '100%';
  mountContainer.style.height = '100%';
  mountContainer.style.pointerEvents = 'none';
  shadowRoot.appendChild(mountContainer);

  // Append host to document
  (document.body || document.documentElement).appendChild(hostElement);

  return shadowRoot;
}

/**
 * Mount or update the floating explanation overlay with the provided context.
 *
 * @param {Object} context - Extracted selection context payload
 */
export function mountCurioOverlay(context) {
  const selectedText = context?.selectedText || context?.text;
  if (!context || !selectedText) {
    console.warn('[Curio] mountCurioOverlay called without selectedText');
    return;
  }
  context.selectedText = selectedText;

  ensureShadowEnvironment();

  if (!reactRoot && mountContainer) {
    reactRoot = createRoot(mountContainer);
  }

  // Render or re-render (smooth update if already mounted)
  if (reactRoot) {
    reactRoot.render(
      <FloatingOverlay
        context={context}
        onClose={unmountCurioOverlay}
      />
    );
  }
}

/**
 * Unmount the React tree and clean up the overlay.
 */
export function unmountCurioOverlay() {
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }

  if (hostElement && hostElement.parentNode) {
    hostElement.parentNode.removeChild(hostElement);
  }

  hostElement = null;
  shadowRoot = null;
  mountContainer = null;
}

/**
 * Check if the overlay is currently mounted and visible.
 * @returns {boolean}
 */
export function isOverlayMounted() {
  return hostElement !== null && document.contains(hostElement);
}

