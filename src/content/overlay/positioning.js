/**
 * Curio — Viewport-Aware Floating Position Engine
 *
 * Calculates optimal coordinates for the floating explanation overlay
 * relative to the user's text selection bounding box.
 *
 * Features:
 *  - Viewport boundary collision avoidance
 *  - Automatic flip (above/below selection) based on remaining vertical clearance
 *  - Horizontal clamping to prevent screen edge overflow
 *  - Fallback viewport centering if selection rect is unavailable
 *  - Drag boundary constraints
 *
 * @module overlay/positioning
 */

const SCREEN_PADDING = 16;
const SELECTION_GAP = 10;
const DEFAULT_CARD_WIDTH = 450;
const DEFAULT_CARD_HEIGHT = 520;

/**
 * @typedef {Object} OverlayCoordinates
 * @property {number} top - Top position in CSS pixels (viewport-fixed)
 * @property {number} left - Left position in CSS pixels (viewport-fixed)
 * @property {'below'|'above'|'center'} placement - Relative placement mode
 * @property {number} maxHeight - Maximum allowed height without overflowing viewport
 */

/**
 * Calculate the optimal position for the floating overlay.
 *
 * @param {Object|null} selectionRect - Viewport coordinates from getBoundingClientRect()
 * @param {Object} [measuredDimensions] - Actual or estimated card dimensions
 * @param {number} [measuredDimensions.width]
 * @param {number} [measuredDimensions.height]
 * @returns {OverlayCoordinates}
 */
export function calculateOverlayPosition(selectionRect, measuredDimensions = {}) {
  const cardWidth = measuredDimensions.width || DEFAULT_CARD_WIDTH;
  const cardHeight = measuredDimensions.height || DEFAULT_CARD_HEIGHT;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Fallback: If no valid selection rect is available, center the card
  if (
    !selectionRect ||
    typeof selectionRect.top !== 'number' ||
    (selectionRect.width === 0 && selectionRect.height === 0)
  ) {
    return {
      top: Math.max(SCREEN_PADDING, Math.round((vh - cardHeight) / 2)),
      left: Math.max(SCREEN_PADDING, Math.round((vw - cardWidth) / 2)),
      placement: 'center',
      maxHeight: vh - SCREEN_PADDING * 2,
    };
  }

  // ─── Vertical Placement Calculation ────────────────────────────────
  const spaceBelow = vh - (selectionRect.bottom + SELECTION_GAP + SCREEN_PADDING);
  const spaceAbove = selectionRect.top - SELECTION_GAP - SCREEN_PADDING;

  let top = 0;
  let placement = 'below';
  let maxHeight = vh - SCREEN_PADDING * 2;

  // Primary preference: place below selection if space allows
  if (spaceBelow >= cardHeight) {
    top = selectionRect.bottom + SELECTION_GAP;
    placement = 'below';
    maxHeight = Math.min(cardHeight, spaceBelow);
  }
  // Secondary preference: flip above selection if space above is sufficient
  else if (spaceAbove >= cardHeight) {
    top = selectionRect.top - SELECTION_GAP - cardHeight;
    placement = 'above';
    maxHeight = Math.min(cardHeight, spaceAbove);
  }
  // Constrained space: pick the side with greater clearance
  else if (spaceBelow >= spaceAbove) {
    top = selectionRect.bottom + SELECTION_GAP;
    placement = 'below';
    maxHeight = Math.max(260, spaceBelow);
  } else {
    top = Math.max(SCREEN_PADDING, selectionRect.top - SELECTION_GAP - Math.max(260, spaceAbove));
    placement = 'above';
    maxHeight = Math.max(260, spaceAbove);
  }

  // Final vertical boundary clamp
  top = Math.max(SCREEN_PADDING, Math.min(top, vh - cardHeight - SCREEN_PADDING));

  // ─── Horizontal Placement Calculation ──────────────────────────────
  // Align with the start of the selection, or center over short selections
  let left = selectionRect.left;

  // If selection is wide, align with selection center
  if (selectionRect.width > 200) {
    left = selectionRect.left + (selectionRect.width / 2) - (cardWidth / 2);
  }

  // Prevent horizontal overflow on right edge
  const maxLeft = vw - cardWidth - SCREEN_PADDING;
  if (left > maxLeft) {
    left = maxLeft;
  }

  // Prevent horizontal overflow on left edge
  if (left < SCREEN_PADDING) {
    left = SCREEN_PADDING;
  }

  return {
    top: Math.round(top),
    left: Math.round(left),
    placement,
    maxHeight: Math.round(maxHeight),
  };
}

/**
 * Constrain coordinates when dragging to keep card on screen.
 *
 * @param {{ top: number, left: number }} currentPos
 * @param {{ width: number, height: number }} cardSize
 * @returns {{ top: number, left: number }}
 */
export function clampDragPosition(currentPos, cardSize) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const minLeft = SCREEN_PADDING;
  const maxLeft = Math.max(SCREEN_PADDING, vw - (cardSize.width || DEFAULT_CARD_WIDTH) - SCREEN_PADDING);
  const minTop = SCREEN_PADDING;
  const maxTop = Math.max(SCREEN_PADDING, vh - (cardSize.height || DEFAULT_CARD_HEIGHT) - SCREEN_PADDING);

  return {
    left: Math.max(minLeft, Math.min(currentPos.left, maxLeft)),
    top: Math.max(minTop, Math.min(currentPos.top, maxTop)),
  };
}

