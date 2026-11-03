/**
 * Curio — Contenteditable Selection Strategy
 *
 * Handles text extraction from contenteditable elements (rich-text editors,
 * Notion-like apps, Google Docs-style editors, Medium, etc.).
 *
 * Contenteditable selections are read through window.getSelection() but the
 * ancestor detection differs. This module identifies contenteditable context
 * and enriches raw selection data with that information.
 *
 * @module selection/editableSelector
 */

/**
 * @typedef {import('./standardSelector.js').RawSelection} RawSelection
 */

/**
 * Walk up from a node to find the nearest contenteditable ancestor.
 * @param {Node|null} node
 * @returns {Element|null}
 */
function findContentEditableAncestor(node) {
  let el = node instanceof Element ? node : node?.parentElement;
  while (el) {
    if (el.isContentEditable && el.getAttribute('contenteditable') !== 'false') {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

/**
 * Attempt to extract a selection from within a contenteditable region.
 * Returns null if the selection is not inside a contenteditable.
 * @returns {RawSelection|null}
 */
export function getEditableSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const anchorEditable = findContentEditableAncestor(selection.anchorNode);
  if (!anchorEditable) {
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
    anchorNode: selection.anchorNode,
    focusNode: selection.focusNode,
    commonAncestor,
    _editableMeta: {
      editableRoot: anchorEditable,
      editableTagName: anchorEditable.tagName.toLowerCase(),
    },
  };
}

