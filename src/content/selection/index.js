/**
 * Curio — Universal Selection Engine (Facade)
 *
 * This is the primary entry point for capturing user selections across
 * any website. It orchestrates a multi-strategy pipeline:
 *
 *   1. Input/Textarea selector  (form controls)
 *   2. Shadow DOM selector       (web components)
 *   3. Contenteditable selector   (rich-text editors)
 *   4. Standard DOM selector      (everything else)
 *
 * After obtaining a raw selection, it classifies the content type
 * (code / math / prose / input) and normalizes the output.
 *
 * The engine also maintains a selection snapshot cache so that
 * selections that disappear after keyboard interaction can still
 * be retrieved.
 *
 * @module selection/index
 */

import { getInputSelection } from './inputSelector.js';
import { getShadowDOMSelection } from './shadowSelector.js';
import { getEditableSelection } from './editableSelector.js';
import { getIframeSelection } from './iframeSelector.js';
import { getStandardSelection } from './standardSelector.js';
import { isInsideCodeBlock, processCodeSelection } from './codeSelector.js';
import { isInsideMathBlock, processMathSelection } from './mathSelector.js';
import { classifyContentType, classifySelectionType } from './classifier.js';

export { classifyContentType, classifySelectionType };

/**
 * @typedef {Object} SelectionSnapshot
 * @property {string} text - The normalized selected text
 * @property {string} rawText - The original unprocessed selection text
 * @property {'general_text'|'programming_code'|'technical_terminology'|'mathematical_expression'|'abbreviation'|'other'|'prose'|'code'|'math'|'input'} contentType - Classified content type
 * @property {'word'|'sentence'|'paragraph'|'multi_paragraph'|'code'|'math'} selectionType - Classified structural selection type
 * @property {string|null} language - Programming language for code selections
 * @property {DOMRect|null} rect - Bounding client rect of the selection
 * @property {Element|null} anchorElement - The element where selection is anchored
 * @property {Element|null} commonAncestor - Common ancestor element of the range
 * @property {Range|null} range - The DOM Range if available
 * @property {string} strategy - Which selection strategy was used
 * @property {number} timestamp - When this snapshot was captured
 */

/** Maximum selection text length (characters). Beyond this is likely accidental. */
const MAX_SELECTION_LENGTH = 15000;

/** Minimum selection length (characters). Single characters are rarely useful. */
const MIN_SELECTION_LENGTH = 1;

/**
 * The most recently captured valid selection snapshot.
 * Used as fallback when keyboard shortcuts clear the selection.
 * @type {SelectionSnapshot|null}
 */
let lastValidSnapshot = null;

/** Timestamp threshold for snapshot staleness (10 seconds) */
const SNAPSHOT_TTL_MS = 10000;

/**
 * Capture a raw selection using the multi-strategy pipeline.
 * Strategies are tried in priority order; the first non-null result wins.
 * @returns {{ raw: import('./standardSelector.js').RawSelection, strategy: string }|null}
 */
function captureRawSelection() {
  // Strategy 1: Form inputs (highest priority when focused)
  const inputSel = getInputSelection();
  if (inputSel) return { raw: inputSel, strategy: 'input' };

  // Strategy 2: Shadow DOM
  const shadowSel = getShadowDOMSelection();
  if (shadowSel) return { raw: shadowSel, strategy: 'shadow' };

  // Strategy 3: Contenteditable regions
  const editableSel = getEditableSelection();
  if (editableSel) return { raw: editableSel, strategy: 'contenteditable' };

  // Strategy 4: IFrame (same-origin iframe focused or active)
  const iframeSel = getIframeSelection();
  if (iframeSel) return { raw: iframeSel, strategy: 'iframe' };

  // Strategy 5: Standard DOM selection (most common)
  const standardSel = getStandardSelection();
  if (standardSel) return { raw: standardSel, strategy: 'standard' };

  return null;
}

/**
 * Classify the content type based on the ancestor elements around
 * the selection and apply content-specific normalization.
 *
 * @param {string} rawText
 * @param {Element|null} anchorElement
 * @param {string} strategy
 * @returns {{ text: string, contentType: string, selectionType: string, language: string|null }}
 */
function classifyAndNormalize(rawText, anchorElement, strategy) {
  const primaryContentType = classifyContentType(rawText, anchorElement, strategy);

  let text = rawText ? rawText.trim() : '';
  let language = null;

  if (primaryContentType === 'mathematical_expression') {
    const { cleanedMath } = processMathSelection(rawText, anchorElement);
    text = cleanedMath || text;
  } else if (primaryContentType === 'programming_code') {
    const { cleanedCode, language: detectedLang } = processCodeSelection(rawText, anchorElement);
    text = cleanedCode || text;
    language = detectedLang;
  } else if (strategy !== 'input') {
    text = normalizeProseText(rawText);
  }

  const selectionType = classifySelectionType(text, primaryContentType);

  return {
    text,
    contentType: primaryContentType,
    selectionType,
    language,
  };
}

/**
 * Normalize standard prose text: collapse excessive whitespace,
 * remove zero-width characters, preserve paragraph breaks.
 * @param {string} text
 * @returns {string}
 */
function normalizeProseText(text) {
  return text
    // Remove zero-width spaces and joiners
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    // Collapse runs of spaces/tabs within lines to single space
    .replace(/[^\S\n]+/g, ' ')
    // Collapse 3+ newlines to double newline (paragraph break)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Validate that a selection snapshot meets minimum quality requirements.
 * @param {string} text
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateSelection(text) {
  if (!text || text.trim().length < MIN_SELECTION_LENGTH) {
    return { valid: false, reason: 'empty' };
  }

  if (text.length > MAX_SELECTION_LENGTH) {
    return { valid: false, reason: 'too_large' };
  }

  // Check if the selection is only whitespace or control characters
  if (/^[\s\u200B\u200C\u200D\uFEFF]+$/.test(text)) {
    return { valid: false, reason: 'whitespace_only' };
  }

  return { valid: true };
}

/**
 * Resolve the anchor element from a raw selection result.
 * @param {import('./standardSelector.js').RawSelection} raw
 * @returns {Element|null}
 */
function resolveAnchorElement(raw) {
  if (raw.anchorNode instanceof Element) return raw.anchorNode;
  if (raw.anchorNode?.parentElement) return raw.anchorNode.parentElement;
  return raw.commonAncestor;
}

/**
 * Capture the current user selection, classify and normalize it,
 * and return a validated SelectionSnapshot.
 *
 * @returns {SelectionSnapshot|null} The snapshot, or null if no valid selection.
 */
export function captureSelection() {
  const result = captureRawSelection();
  if (!result) return null;

  const { raw, strategy } = result;
  const anchorElement = resolveAnchorElement(raw);

  const { text, contentType, selectionType, language } = classifyAndNormalize(
    raw.text,
    anchorElement,
    strategy
  );

  const validation = validateSelection(text);
  if (!validation.valid) {
    return null;
  }

  // Clamp excessively long selections
  const clampedText = text.length > MAX_SELECTION_LENGTH
    ? text.substring(0, MAX_SELECTION_LENGTH)
    : text;

  /** @type {SelectionSnapshot} */
  const snapshot = {
    text: clampedText,
    rawText: raw.text,
    contentType,
    selectionType,
    language,
    rect: raw.rect || null,
    anchorElement,
    commonAncestor: raw.commonAncestor,
    range: raw.range,
    strategy,
    timestamp: Date.now(),
  };

  // Cache as last valid snapshot
  lastValidSnapshot = snapshot;

  return snapshot;
}

/**
 * Get the current selection, or fall back to the most recent valid snapshot
 * if the selection has disappeared (e.g., after pressing a hotkey).
 *
 * @returns {SelectionSnapshot|null}
 */
export function captureSelectionWithFallback() {
  // Try live selection first
  const live = captureSelection();
  if (live) return live;

  // Fallback to cached snapshot if it's not stale
  if (lastValidSnapshot) {
    const age = Date.now() - lastValidSnapshot.timestamp;
    if (age < SNAPSHOT_TTL_MS) {
      return lastValidSnapshot;
    }
    // Stale snapshot, discard
    lastValidSnapshot = null;
  }

  return null;
}

/**
 * Update the cached selection snapshot.
 * Called on pointerup and keyup to keep the snapshot fresh.
 */
export function updateSelectionSnapshot() {
  const snapshot = captureSelection();
  if (snapshot) {
    lastValidSnapshot = snapshot;
  }
}

/**
 * Clear the cached selection snapshot.
 */
export function clearSelectionSnapshot() {
  lastValidSnapshot = null;
}

/**
 * Get the last cached snapshot without attempting to read the DOM.
 * @returns {SelectionSnapshot|null}
 */
export function getLastSnapshot() {
  if (!lastValidSnapshot) return null;
  const age = Date.now() - lastValidSnapshot.timestamp;
  if (age > SNAPSHOT_TTL_MS) {
    lastValidSnapshot = null;
    return null;
  }
  return lastValidSnapshot;
}

