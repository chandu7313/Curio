/**
 * Curio — Mathematical Expression Selection Extractor
 *
 * When users select rendered math (KaTeX, MathJax, or native MathML),
 * the visible text is garbled SVG path glyphs or fragmented HTML.
 *
 * This module finds semantic backing annotations that contain the
 * original LaTeX/TeX source and returns clean mathematical notation
 * instead of visual garbage.
 *
 * @module selection/mathSelector
 */

/**
 * @typedef {import('./standardSelector.js').RawSelection} RawSelection
 */

/**
 * Known math container selectors for common rendering libraries.
 */
const MATH_CONTAINER_SELECTORS = [
  // KaTeX
  '.katex',
  '.katex-display',
  '.katex-html',
  // MathJax 2.x
  '.MathJax',
  '.MathJax_Display',
  '.MathJax_Preview',
  // MathJax 3.x
  'mjx-container',
  'mjx-math',
  // Native MathML
  'math',
  // Generic wrappers
  '.math-container',
  '.math-display',
  '[data-math]',
];

/**
 * Check if a given element is inside a math container.
 * @param {Element|null} element
 * @returns {boolean}
 */
export function isInsideMathBlock(element) {
  if (!element) return false;

  for (const selector of MATH_CONTAINER_SELECTORS) {
    if (element.closest(selector)) return true;
  }
  return false;
}

/**
 * Find the outermost math container wrapping an element.
 * @param {Element|null} element
 * @returns {Element|null}
 */
function findMathContainer(element) {
  if (!element) return null;

  let outermost = null;
  for (const selector of MATH_CONTAINER_SELECTORS) {
    const match = element.closest(selector);
    if (match) {
      // Keep the outermost container (broadest scope)
      if (!outermost || outermost.contains(match)) {
        outermost = match;
      }
    }
  }
  return outermost;
}

/**
 * Attempt to extract clean LaTeX source from a KaTeX-rendered element.
 * KaTeX stores the TeX source in an <annotation encoding="application/x-tex"> element.
 * @param {Element} container
 * @returns {string|null}
 */
function extractKaTeXSource(container) {
  const annotation = container.querySelector(
    'annotation[encoding="application/x-tex"]'
  );
  if (annotation && annotation.textContent) {
    return annotation.textContent.trim();
  }

  // Fallback: KaTeX sometimes stores TeX in a data attribute
  const texAttr = container.getAttribute('data-tex') ||
                  container.getAttribute('data-latex');
  if (texAttr) return texAttr.trim();

  return null;
}

/**
 * Attempt to extract clean LaTeX source from a MathJax-rendered element.
 * MathJax 2.x uses <script type="math/tex"> siblings.
 * MathJax 3.x uses <mjx-container> with internal semantic nodes.
 * @param {Element} container
 * @returns {string|null}
 */
function extractMathJaxSource(container) {
  // MathJax 2.x: look for sibling <script type="math/tex">
  const script = container.querySelector('script[type="math/tex"]') ||
                 container.querySelector('script[type="math/tex; mode=display"]');
  if (script && script.textContent) {
    return script.textContent.trim();
  }

  // MathJax 2.x: check previous sibling (common layout)
  const prevSibling = container.previousElementSibling;
  if (
    prevSibling &&
    prevSibling.tagName === 'SCRIPT' &&
    prevSibling.getAttribute('type')?.includes('math/tex')
  ) {
    return prevSibling.textContent?.trim() || null;
  }

  // MathJax 3.x: look for internal <annotation> in semantic MathML
  const annotation = container.querySelector(
    'annotation[encoding="application/x-tex"]'
  );
  if (annotation && annotation.textContent) {
    return annotation.textContent.trim();
  }

  // MathJax 3.x: data attribute on mjx-container
  if (container.tagName === 'MJX-CONTAINER') {
    // MathJax 3 injects TeX via data attributes on some configurations
    const ariaLabel = container.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();
  }

  return null;
}

/**
 * Attempt to extract LaTeX/math source from native MathML.
 * @param {Element} container
 * @returns {string|null}
 */
function extractMathMLSource(container) {
  const annotation = container.querySelector(
    'annotation[encoding="application/x-tex"]'
  );
  if (annotation && annotation.textContent) {
    return annotation.textContent.trim();
  }

  // Fallback: serialize the MathML itself
  if (container.tagName === 'math' || container.tagName === 'MATH') {
    const alttext = container.getAttribute('alttext');
    if (alttext) return alttext.trim();
  }

  return null;
}

/**
 * Given a selection anchor inside a math container, extract the clean
 * LaTeX/TeX source instead of the garbled rendered text.
 *
 * @param {string} rawText - The raw selected text (may be garbled)
 * @param {Element|null} anchorElement - The element the selection starts in
 * @returns {{ cleanedMath: string|null, format: string, container: Element|null }}
 */
export function processMathSelection(rawText, anchorElement) {
  const container = findMathContainer(anchorElement);
  if (!container) {
    return { cleanedMath: null, format: 'unknown', container: null };
  }

  // Try KaTeX
  const katex = extractKaTeXSource(container);
  if (katex) {
    return { cleanedMath: katex, format: 'latex', container };
  }

  // Try MathJax
  const mathjax = extractMathJaxSource(container);
  if (mathjax) {
    return { cleanedMath: mathjax, format: 'latex', container };
  }

  // Try native MathML
  const mathml = extractMathMLSource(container);
  if (mathml) {
    return { cleanedMath: mathml, format: 'latex', container };
  }

  // Fallback: if we know it's math but can't find clean source,
  // return the raw text as-is. It may still be partially useful.
  return { cleanedMath: rawText?.trim() || null, format: 'raw', container };
}

