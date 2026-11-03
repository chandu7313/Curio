/**
 * Curio — Standard DOM Selection Strategy
 *
 * Extracts text from the standard window.getSelection() API.
 * Works on normal prose, articles, documentation, and most web content.
 *
 * @module selection/standardSelector
 */

/**
 * @typedef {Object} RawSelection
 * @property {string} text - The selected text (untrimmed)
 * @property {Range|null} range - The DOM Range object if available
 * @property {DOMRect|null} rect - Bounding client rect of the selection
 * @property {Node|null} anchorNode - The node where selection started
 * @property {Node|null} focusNode - The node where selection ended
 * @property {Element|null} commonAncestor - The common ancestor element
 */

/**
 * Attempt to extract a selection from window.getSelection().
 * @returns {RawSelection|null} The raw selection data, or null if nothing selected.
 */
export function getStandardSelection() {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const text = selection.toString();
  if (!text || text.trim().length === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  let rect = null;

  try {
    const domRect = range.getBoundingClientRect();
    // Guard against collapsed or zero-area rects which occur on hidden elements
    if (domRect && (domRect.width > 0 || domRect.height > 0)) {
      rect = domRect;
    }
  } catch (_e) {
    // getBoundingClientRect can throw on detached ranges in edge cases
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
    anchorNode: selection.anchorNode,
    focusNode: selection.focusNode,
    commonAncestor,
  };
}

