/**
 * Curio — Shadow DOM Selection Strategy
 *
 * Modern web components (YouTube, Lit, Polymer, Shoelace, custom design systems)
 * encapsulate content inside Shadow Roots. Standard window.getSelection() may
 * not pierce shadow boundaries.
 *
 * This module traverses activeElement chains through shadow roots to locate
 * selections within shadow trees, and attempts to read selections from open
 * shadow roots where the browser allows.
 *
 * @module selection/shadowSelector
 */

/**
 * @typedef {import('./standardSelector.js').RawSelection} RawSelection
 */

/**
 * Walk the activeElement chain through shadow roots to find the deepest
 * focused element. In Chromium, each ShadowRoot may have its own activeElement.
 * @returns {Element|null}
 */
function getDeepActiveElement() {
  let el = document.activeElement;
  while (el && el.shadowRoot && el.shadowRoot.activeElement) {
    el = el.shadowRoot.activeElement;
  }
  return el;
}

/**
 * Attempt to get a Selection object from the shadow root that contains
 * the deepest active element. Chromium supports getSelection() on
 * ShadowRoot for open shadow trees.
 * @param {Element} deepElement
 * @returns {Selection|null}
 */
function getShadowSelection(deepElement) {
  // Walk up to find the ShadowRoot that hosts deepElement
  let node = deepElement;
  while (node) {
    const root = node.getRootNode();
    if (root instanceof ShadowRoot) {
      // Chromium supports getSelection on ShadowRoot (non-standard but functional)
      if (typeof root.getSelection === 'function') {
        try {
          return root.getSelection();
        } catch (_e) {
          return null;
        }
      }
      return null;
    }
    // If we reached the document, stop
    if (root === document) break;
    node = root.host;
  }
  return null;
}

/**
 * Attempt to extract a selection from within a Shadow DOM tree.
 * @returns {RawSelection|null}
 */
export function getShadowDOMSelection() {
  const deepEl = getDeepActiveElement();
  if (!deepEl) return null;

  // Check if deepEl lives inside a ShadowRoot
  const rootNode = deepEl.getRootNode();
  if (!(rootNode instanceof ShadowRoot)) {
    return null; // Not inside shadow DOM, defer to other strategies
  }

  // Try to get the selection from the shadow root
  const shadowSel = getShadowSelection(deepEl);
  if (!shadowSel || shadowSel.isCollapsed || shadowSel.rangeCount === 0) {
    // Fallback: if deep element is an input/textarea inside shadow DOM,
    // try to read its value directly
    if (
      deepEl instanceof HTMLInputElement ||
      deepEl instanceof HTMLTextAreaElement
    ) {
      let start, end;
      try {
        start = deepEl.selectionStart;
        end = deepEl.selectionEnd;
      } catch (_e) {
        return null;
      }
      if (start !== null && end !== null && start !== end) {
        const text = deepEl.value.substring(start, end);
        if (text && text.trim().length > 0) {
          return {
            text,
            range: null,
            rect: deepEl.getBoundingClientRect(),
            anchorNode: deepEl,
            focusNode: deepEl,
            commonAncestor: deepEl,
            _shadowMeta: {
              shadowHost: rootNode.host,
              fromInput: true,
            },
          };
        }
      }
    }
    return null;
  }

  const text = shadowSel.toString();
  if (!text || text.trim().length === 0) {
    return null;
  }

  const range = shadowSel.getRangeAt(0);
  let rect = null;
  try {
    const domRect = range.getBoundingClientRect();
    if (domRect && (domRect.width > 0 || domRect.height > 0)) {
      rect = domRect;
    }
  } catch (_e) {
    rect = null;
  }

  const commonAncestorNode = range.commonAncestorContainer;
  const commonAncestor =
    commonAncestorNode instanceof Element
      ? commonAncestorNode
      : commonAncestorNode.parentElement;

  return {
    text,
    range,
    rect,
    anchorNode: shadowSel.anchorNode,
    focusNode: shadowSel.focusNode,
    commonAncestor,
    _shadowMeta: {
      shadowHost: rootNode.host,
      fromInput: false,
    },
  };
}

