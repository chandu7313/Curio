/**
 * Curio — Context Extraction Engine
 *
 * Takes a SelectionSnapshot and enriches it with surrounding context:
 *   - Enclosing sentence
 *   - Enclosing paragraph / block text
 *   - Nearest heading
 *   - Page metadata
 *   - Sanitized URL
 *
 * The engine walks the DOM semantically to build a context window that
 * gives the AI model enough information to disambiguate the selection
 * without sending the entire page.
 *
 * @module context/index
 */

/**
 * @typedef {Object} ExtractedContext
 * @property {string} selectedText - The cleaned selected text
 * @property {'prose'|'code'|'math'|'input'} contentType - Content classification
 * @property {string|null} language - Detected language for code
 * @property {string} sentence - The enclosing sentence (best effort)
 * @property {string} paragraph - The enclosing paragraph / block text
 * @property {string} precedingText - Text before the selection (context window)
 * @property {string} succeedingText - Text after the selection (context window)
 * @property {string|null} nearestHeading - Closest preceding heading text
 * @property {Object} pageMetadata - Title, URL, domain, meta description
 * @property {Object|null} boundingBox - Position for floating UI placement
 * @property {number} timestamp - Capture time
 */

/** Default context window size in characters on each side of the selection */
const DEFAULT_CONTEXT_WINDOW = 500;

/** Maximum paragraph text length to include */
const MAX_PARAGRAPH_LENGTH = 2000;

/** Maximum heading search depth (how far up/back to look) */
const MAX_HEADING_SEARCH_DEPTH = 50;

/**
 * Block-level element selectors for walking up the DOM.
 * Includes semantic HTML containers, AI chat bubble wrappers
 * (ChatGPT, Claude, Gemini, Perplexity), and documentation layouts.
 */
const BLOCK_SELECTORS = [
  'p', 'article', 'section', 'main', 'li', 'blockquote',
  'td', 'th', 'dt', 'dd', 'figcaption', 'details', 'summary',
  'aside', 'header', 'footer',
  // AI chat bubble containers
  '[data-message-author-role="assistant"]',
  '[data-message-author-role="user"]',
  '.agent-turn',
  '.prose',
  'div[class*="markdown"]',
  '.font-claude-message',
  'model-response',
  '.response-container-content',
  // Developer documentation containers
  '.markdown-body',
  '.s-prose',
  '.theme-doc-markdown',
  '.md-content',
  '.vp-doc',
  'div',
].join(', ');

/**
 * Heading selectors.
 */
const HEADING_SELECTORS = 'h1, h2, h3, h4, h5, h6';

/**
 * Find the nearest enclosing block-level container from a node.
 * @param {Node|null} node
 * @returns {Element|null}
 */
function findBlockContainer(node) {
  if (!node) return null;

  const el = node instanceof Element ? node : node.parentElement;
  if (!el) return null;

  // For code blocks, use the <pre> or code container directly
  const codePre = el.closest('pre, .highlight, .s-code-block, .cm-editor');
  if (codePre) return codePre;

  const block = el.closest(BLOCK_SELECTORS);
  return block || el;
}

/**
 * Extract text from a block container, cleaned and truncated.
 * @param {Element|null} container
 * @returns {string}
 */
function extractBlockText(container) {
  if (!container) return '';

  const text = container.textContent || '';
  const cleaned = text
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.substring(0, MAX_PARAGRAPH_LENGTH);
}

/**
 * Extract preceding and succeeding text around the selection within
 * the block container.
 *
 * @param {string} selectedText
 * @param {Element|null} blockContainer
 * @param {number} [windowSize]
 * @returns {{ precedingText: string, succeedingText: string }}
 */
function extractSurroundingText(selectedText, blockContainer, windowSize = DEFAULT_CONTEXT_WINDOW) {
  if (!blockContainer || !selectedText) {
    return { precedingText: '', succeedingText: '' };
  }

  const fullText = blockContainer.textContent || '';
  const normalizedFull = fullText.replace(/\s+/g, ' ');
  const normalizedSelection = selectedText.replace(/\s+/g, ' ').trim();

  const matchIndex = normalizedFull.indexOf(normalizedSelection);

  if (matchIndex === -1) {
    // Selection not found in block text—try broader search
    // Use first 40 chars as fuzzy anchor
    const anchor = normalizedSelection.substring(0, 40);
    const fuzzyIndex = normalizedFull.indexOf(anchor);
    if (fuzzyIndex === -1) {
      return { precedingText: '', succeedingText: '' };
    }

    return {
      precedingText: normalizedFull.substring(
        Math.max(0, fuzzyIndex - windowSize),
        fuzzyIndex
      ).trim(),
      succeedingText: normalizedFull.substring(
        fuzzyIndex + anchor.length,
        Math.min(normalizedFull.length, fuzzyIndex + anchor.length + windowSize)
      ).trim(),
    };
  }

  return {
    precedingText: normalizedFull.substring(
      Math.max(0, matchIndex - windowSize),
      matchIndex
    ).trim(),
    succeedingText: normalizedFull.substring(
      matchIndex + normalizedSelection.length,
      Math.min(normalizedFull.length, matchIndex + normalizedSelection.length + windowSize)
    ).trim(),
  };
}

/**
 * Attempt to extract the enclosing sentence for the selected text.
 * Uses regex-based sentence boundary detection on the paragraph text.
 *
 * @param {string} selectedText
 * @param {string} paragraphText
 * @returns {string}
 */
export function extractEnclosingSentence(selectedText, paragraphText) {
  if (!paragraphText || !selectedText) return '';

  const normalizedPara = paragraphText.replace(/\s+/g, ' ');
  const normalizedSel = selectedText.replace(/\s+/g, ' ').trim();

  // Split on sentence boundaries (., !, ? followed by space or end)
  // This is a reasonable heuristic; not perfect for all languages.
  const sentences = (normalizedPara.match(/[^.!?]+(?:[.!?]+(?:\s+|$)|$)/g) || [])
    .map((s) => s.trim())
    .filter(Boolean);

  // Find the sentence containing the selection
  for (const sentence of sentences) {
    if (sentence.includes(normalizedSel) || normalizedSel.includes(sentence)) {
      return sentence;
    }
  }

  // Fallback: return a ~200 char window around the selection
  const idx = normalizedPara.indexOf(normalizedSel);
  if (idx !== -1) {
    const start = Math.max(0, idx - 100);
    const end = Math.min(normalizedPara.length, idx + normalizedSel.length + 100);
    return normalizedPara.substring(start, end).trim();
  }

  return '';
}

/**
 * Search for the nearest preceding heading element relative to a given node.
 * Walks backward through siblings and up the DOM tree.
 *
 * @param {Element|null} element
 * @returns {string|null}
 */
function findNearestHeading(element) {
  if (!element) return null;

  // Strategy 1: Walk up to find a heading ancestor
  const headingAncestor = element.closest(HEADING_SELECTORS);
  if (headingAncestor) {
    return headingAncestor.textContent?.trim() || null;
  }

  // Strategy 2: Walk backward through preceding siblings and their children
  let current = element;
  let depth = 0;

  while (current && depth < MAX_HEADING_SEARCH_DEPTH) {
    // Check previous siblings
    let sibling = current.previousElementSibling;
    while (sibling && depth < MAX_HEADING_SEARCH_DEPTH) {
      // Check if sibling itself is a heading
      if (sibling.matches(HEADING_SELECTORS)) {
        return sibling.textContent?.trim() || null;
      }

      // Check if sibling contains a heading (last one = closest)
      const headings = sibling.querySelectorAll(HEADING_SELECTORS);
      if (headings.length > 0) {
        const lastHeading = headings[headings.length - 1];
        return lastHeading.textContent?.trim() || null;
      }

      sibling = sibling.previousElementSibling;
      depth++;
    }

    // Move up to parent and continue
    current = current.parentElement;
    depth++;
  }

  return null;
}

/**
 * Sanitize a URL for privacy before sending to the AI backend.
 * Removes auth tokens, session IDs, and tracking parameters.
 * @param {string} url
 * @returns {string}
 */
export function sanitizeUrl(url) {
  try {
    const parsed = new URL(url);

    // Remove sensitive query parameters
    const sensitiveParams = [
      'token', 'auth', 'key', 'secret', 'session', 'sid',
      'password', 'passwd', 'access_token', 'refresh_token',
      'api_key', 'apikey', 'jwt',
      // Tracking
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'mc_eid', 'mc_cid',
    ];

    for (const param of sensitiveParams) {
      parsed.searchParams.delete(param);
    }

    // Remove hash if it looks like a token (long base64-ish strings)
    if (parsed.hash && parsed.hash.length > 30) {
      parsed.hash = '';
    }

    return parsed.toString();
  } catch (_e) {
    // If URL parsing fails, return origin only
    return url.split('?')[0].split('#')[0];
  }
}

/**
 * Extract a meta description from the page.
 * @returns {string|null}
 */
function getMetaDescription() {
  const meta = document.querySelector(
    'meta[name="description"], meta[property="og:description"]'
  );
  return meta?.getAttribute('content')?.trim() || null;
}

/**
 * Convert a DOMRect to a plain serializable object.
 * @param {DOMRect|null} domRect
 * @returns {Object|null}
 */
function serializeRect(domRect) {
  if (!domRect) return null;
  return {
    top: Math.round(domRect.top),
    left: Math.round(domRect.left),
    bottom: Math.round(domRect.bottom),
    right: Math.round(domRect.right),
    width: Math.round(domRect.width),
    height: Math.round(domRect.height),
  };
}

/**
 * Build a complete ExtractedContext from a SelectionSnapshot.
 *
 * This is the primary entry point for the context extraction engine.
 *
 * @param {import('../selection/index.js').SelectionSnapshot} snapshot
 * @param {Object} [options]
 * @param {number} [options.contextWindowSize] - Characters of surrounding context
 * @returns {ExtractedContext}
 */
export function extractContext(snapshot, options = {}) {
  const contextWindowSize = options.contextWindowSize || DEFAULT_CONTEXT_WINDOW;
  const rawSelected = snapshot?.text || snapshot?.selectedText || '';

  // Find the block-level container
  const blockContainer = findBlockContainer(
    snapshot?.anchorElement || snapshot?.commonAncestor
  );

  // Extract block/paragraph text
  const paragraphText = extractBlockText(blockContainer);

  // Extract surrounding text window
  const { precedingText, succeedingText } = extractSurroundingText(
    rawSelected,
    blockContainer,
    contextWindowSize
  );

  // Extract enclosing sentence
  const sentence = extractEnclosingSentence(rawSelected, paragraphText);

  // Find nearest heading
  const nearestHeading = findNearestHeading(
    snapshot?.anchorElement || snapshot?.commonAncestor
  );

  // Page metadata
  const pageMetadata = {
    title: document.title || '',
    url: sanitizeUrl(window.location.href),
    domain: window.location.hostname,
    metaDescription: getMetaDescription(),
  };

  // Bounding box for floating UI positioning
  const boundingBox = serializeRect(snapshot?.rect || snapshot?.selectionRect);
  const selectionRect = boundingBox
    ? {
        top: boundingBox.top,
        left: boundingBox.left,
        width: boundingBox.width,
        height: boundingBox.height,
      }
    : null;

  const pageTitle = (typeof document !== 'undefined' && document.title) || '';
  const pageUrl = typeof window !== 'undefined' ? sanitizeUrl(window.location.href) : '';

  return {
    // ─── Standardized Selection Snapshot Interface ─────────────────────
    selectedText: rawSelected,
    text: rawSelected,
    surroundingSentence: sentence,
    surroundingParagraph: paragraphText,
    pageTitle,
    pageUrl,
    contentType: snapshot.contentType || 'general_text',
    selectionType: snapshot.selectionType || 'word',
    selectionRect,
    timestamp: snapshot.timestamp || Date.now(),

    // ─── Backwards-Compatible Aliases ─────────────────────────────────
    sentence,
    paragraph: paragraphText,
    boundingBox,
    nodeType: snapshot.contentType || 'general_text',
    language: snapshot.language || null,
    precedingText,
    succeedingText,
    nearestHeading,
    pageMetadata,
  };
}

