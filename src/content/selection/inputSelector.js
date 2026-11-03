/**
 * Curio — Input / Textarea Selection Strategy
 *
 * Handles text extraction from <input type="text">, <textarea>,
 * and other form control elements where window.getSelection()
 * does NOT return the selected text.
 *
 * @module selection/inputSelector
 */

/**
 * @typedef {import('./standardSelector.js').RawSelection} RawSelection
 */

/**
 * Check if the given element is a sensitive password field.
 * @param {Element|null} el
 * @returns {boolean}
 */
export function isPasswordInput(el) {
  if (!el) return false;
  return (el.type || '').toLowerCase() === 'password';
}

/**
 * Check if the given element is a selectable form control.
 * Explicitly rejects password inputs to prevent credential leakage.
 * @param {Element|null} el
 * @returns {el is HTMLInputElement|HTMLTextAreaElement}
 */
function isSelectableFormControl(el) {
  if (!el || isPasswordInput(el)) return false;

  if (el instanceof HTMLTextAreaElement) return true;

  if (el instanceof HTMLInputElement) {
    // Only non-sensitive text-like inputs support selectionStart/selectionEnd
    const supportedTypes = [
      'text', 'search', 'url', 'tel',
    ];
    return supportedTypes.includes(el.type);
  }

  return false;
}

/**
 * Attempt to extract a selection from the currently active form control.
 * @returns {RawSelection|null}
 */
export function getInputSelection() {
  const activeEl = document.activeElement;

  if (!isSelectableFormControl(activeEl)) {
    return null;
  }

  let start, end;
  try {
    start = activeEl.selectionStart;
    end = activeEl.selectionEnd;
  } catch (_e) {
    // Some input types throw on selectionStart access
    return null;
  }

  if (start === null || end === null || start === end) {
    return null;
  }

  const text = activeEl.value.substring(start, end);
  if (!text || text.trim().length === 0) {
    return null;
  }

  let rect = null;
  try {
    rect = activeEl.getBoundingClientRect();
  } catch (_e) {
    rect = null;
  }

  return {
    text,
    range: null, // No DOM Range for form inputs
    rect,
    anchorNode: activeEl,
    focusNode: activeEl,
    commonAncestor: activeEl,
    // Extension fields for input context
    _inputMeta: {
      element: activeEl,
      selectionStart: start,
      selectionEnd: end,
      fullValue: activeEl.value,
    },
  };
}

