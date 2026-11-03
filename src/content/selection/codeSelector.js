/**
 * Curio — Code Block Selection Normalizer
 *
 * When users select code from GitHub, Stack Overflow, GitLab, DevDocs, MDN,
 * or any site using syntax highlighters (Prism.js, Highlight.js, Shiki, etc.),
 * the raw selection text is often corrupted:
 *
 *   - Line numbers interleaved: "1 const x = 1\n2 return x"
 *   - Invisible spans splitting tokens: "co" + "nst"
 *   - Extra whitespace from table layout
 *   - Copy buttons and line-action gutters included
 *
 * This module detects code containers and normalises the selection into
 * clean, indentation-preserved code text with an identified language.
 *
 * @module selection/codeSelector
 */

/**
 * Known code container selectors, ordered by specificity.
 * These cover the major syntax highlighter libraries and platforms.
 */
const CODE_CONTAINER_SELECTORS = [
  // Monaco / VS Code Web
  '.monaco-editor .view-lines',
  '.monaco-editor',
  // CodeMirror 5 & 6
  '.CodeMirror-code',
  '.cm-content',
  '.cm-editor',
  // GitHub
  '.highlight table',
  '.highlight',
  '.blob-code-content',
  '.markdown-body pre',
  // GitLab
  '.code.highlight',
  '.blob-content pre',
  // Stack Overflow
  '.s-code-block',
  '.answercell pre',
  // Prism.js
  'pre[class*="language-"]',
  'code[class*="language-"]',
  // Highlight.js
  'pre code.hljs',
  'pre code[class*="hljs"]',
  // Shiki
  'pre.shiki',
  // Generic
  'pre > code',
  'pre',
];

/**
 * Line number gutter selectors to strip from selections.
 */
const LINE_NUMBER_SELECTORS = [
  '.blob-num',                // GitHub
  '.line-numbers',            // Prism
  '.linenumber',              // generic
  '.hljs-ln-numbers',         // Highlight.js line numbers plugin
  'td.line-number',           // generic table
  '.line-number',             // generic
  '.gutter',                  // CodeMirror
  '.cm-gutters',              // CodeMirror 6
  '.cm-gutter',               // CodeMirror 6
  '[data-line-number]',       // generic attr
  '.blob-code-marker-addition', // GitHub diff markers
  '.blob-code-marker-deletion', // GitHub diff markers
];

/**
 * Helper to detect code language directly from class name string.
 * @param {string} className
 * @returns {string|null}
 */
export function detectCodeLanguageFromClassName(className) {
  if (!className || typeof className !== 'string') return null;
  const langMatch = className.match(/(?:language|lang)-(\w[\w+#.-]*)/i);
  if (langMatch) return langMatch[1].toLowerCase();
  const hljsMatch = className.match(/\bhljs\s+(\w+)/i);
  if (hljsMatch) return hljsMatch[1].toLowerCase();
  return null;
}

/**
 * Detect the programming language from class names on a code element.
 * @param {Element|null} el
 * @returns {string|null}
 */
export function detectCodeLanguage(el) {
  if (!el) return null;

  // Walk up at most 3 levels looking for language classes
  let current = el;
  for (let i = 0; i < 4 && current; i++) {
    if (current.className && typeof current.className === 'string') {
      const fromClass = detectCodeLanguageFromClassName(current.className);
      if (fromClass) return fromClass;
    }

    // Check data attributes
    const dataLang = current.getAttribute('data-language') ||
                     current.getAttribute('data-lang');
    if (dataLang) return dataLang.toLowerCase();

    current = current.parentElement;
  }

  return null;
}

/**
 * Find the nearest code container element that encompasses the selection anchor.
 * @param {Element|null} element
 * @returns {Element|null}
 */
export function findCodeContainer(element) {
  if (!element) return null;

  for (const selector of CODE_CONTAINER_SELECTORS) {
    const match = element.closest(selector);
    if (match) return match;
  }

  return null;
}

/**
 * Determine whether a given element is inside a code block.
 * @param {Element|null} element
 * @returns {boolean}
 */
export function isInsideCodeBlock(element) {
  return findCodeContainer(element) !== null;
}

/**
 * Clean selected code text by stripping line numbers, gutter content,
 * copy buttons, and normalizing whitespace artifacts.
 *
 * @param {string} rawText - The raw selected text from the DOM
 * @param {Element|null} codeContainer - The code container element
 * @returns {string} Cleaned code text
 */
export function normalizeCodeSelection(rawText, codeContainer) {
  if (!rawText) return '';

  let cleaned = rawText;

  // Pattern 1: Line numbers at the start of each line (e.g., "  1  const x = 1")
  // Detect if most lines start with digits followed by whitespace
  const lines = cleaned.split('\n');

  if (lines.length > 1) {
    const lineNumPattern = /^\s*(\d+)\s{1,4}/;
    let lineNumCount = 0;

    for (const line of lines) {
      if (line.trim() === '') continue;
      if (lineNumPattern.test(line)) lineNumCount++;
    }

    const nonEmptyLines = lines.filter((l) => l.trim() !== '').length;

    // If >60% of non-empty lines start with numbers, strip them
    if (nonEmptyLines > 0 && lineNumCount / nonEmptyLines > 0.6) {
      cleaned = lines
        .map((line) => {
          if (line.trim() === '') return '';
          return line.replace(lineNumPattern, '');
        })
        .join('\n');
    }
  }

  // Pattern 2: Tab-separated line numbers from table-based renderers
  // "1\tconst x = 1\n2\treturn x"
  const tabLines = cleaned.split('\n');
  const tabNumPattern = /^\d+\t/;
  const tabNumCount = tabLines.filter((l) => l.trim() && tabNumPattern.test(l)).length;
  const tabNonEmpty = tabLines.filter((l) => l.trim()).length;

  if (tabNonEmpty > 0 && tabNumCount / tabNonEmpty > 0.6) {
    cleaned = tabLines
      .map((line) => line.replace(tabNumPattern, ''))
      .join('\n');
  }

  // Pattern 3: Remove common copy-button text artifacts (e.g. ChatGPT, Claude, GitHub)
  cleaned = cleaned
    .replace(/^\s*Copy(?:\s+(?:code|to clipboard|snippet))?\s*$/gim, '')
    .replace(/^\s*Copied!?(?:\s*to clipboard)?\s*$/gim, '');

  // Trim trailing whitespace per line, collapse excessive blank lines
  cleaned = cleaned
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
}

/**
 * Given a selection anchor element, extract clean code with language detection.
 * @param {string} rawText
 * @param {Element|null} anchorElement
 * @returns {{ cleanedCode: string, language: string|null, container: Element|null }}
 */
export function processCodeSelection(rawText, anchorElement) {
  const container = findCodeContainer(anchorElement);
  const language = detectCodeLanguage(container || anchorElement);
  const cleanedCode = normalizeCodeSelection(rawText, container);

  return {
    cleanedCode,
    language,
    container,
  };
}

