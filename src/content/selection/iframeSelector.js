/**
 * Curio — IFrame Selection Strategy
 *
 * Handles text extraction from <iframe> and <frame> elements where
 * permissions allow.
 *
 * For same-origin iframes, pierces the frame boundary from the parent
 * window, computes selection range coordinates, and offsets bounding rects
 * by the iframe's on-screen viewport position.
 *
 * Cross-origin iframes are secured by the browser and will throw a SecurityError
 * on contentDocument access. For cross-origin iframes, Curio relies on
 * "all_frames: true" in Manifest V3 so the content script runs inside each frame.
 *
 * @module selection/iframeSelector
 */

/**
 * @typedef {import('./standardSelector.js').RawSelection} RawSelection
 */

/**
 * Attempt to extract a selection from the currently focused or active iframe.
 * @returns {RawSelection|null}
 */
export function getIframeSelection() {
  const activeEl = document.activeElement;

  if (!activeEl || (activeEl.tagName !== 'IFRAME' && activeEl.tagName !== 'FRAME')) {
    return null;
  }

  let doc = null;
  try {
    doc = activeEl.contentDocument || activeEl.contentWindow?.document;
  } catch (_err) {
    // Cross-origin boundary: browser blocks access; fail gracefully
    return null;
  }

  if (!doc) return null;

  try {
    const sel = doc.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      return null;
    }

    const text = sel.toString();
    if (!text || text.trim().length === 0) {
      return null;
    }

    const range = sel.getRangeAt(0);
    let rect = null;

    try {
      const innerRect = range.getBoundingClientRect();
      const frameRect = activeEl.getBoundingClientRect();

      // Offset inner frame coordinates to parent viewport coordinates
      rect = new DOMRect(
        innerRect.left + frameRect.left,
        innerRect.top + frameRect.top,
        innerRect.width,
        innerRect.height
      );
    } catch (_e) {
      rect = activeEl.getBoundingClientRect();
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
      anchorNode: sel.anchorNode,
      focusNode: sel.focusNode,
      commonAncestor,
      _iframeMeta: {
        frameElement: activeEl,
        sameOrigin: true,
      },
    };
  } catch (_err) {
    return null;
  }
}

