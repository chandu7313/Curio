/**
 * Curio — Universal Selection & Content Type Classifier
 *
 * Classifies selections into standardized content and selection categories:
 *
 * Content Types:
 *   - 'general_text'            (Standard prose, articles, ordinary text)
 *   - 'programming_code'        (Code snippets, syntax blocks, statements)
 *   - 'technical_terminology'   (Identifiers, camelCase, APIs, CS concepts)
 *   - 'mathematical_expression' (LaTeX/TeX formulas, KaTeX/MathJax, MathML)
 *   - 'abbreviation'            (Acronyms, initialisms: e.g. API, DOM, CSS, MV3)
 *   - 'other'                   (Unclassified or miscellaneous content)
 *
 * Selection Types:
 *   - 'word'            (Single word or symbol)
 *   - 'sentence'        (Single sentence or clause)
 *   - 'paragraph'       (Single paragraph)
 *   - 'multi_paragraph' (Multiple paragraphs separated by blank lines)
 *   - 'code'            (Programming code snippet or block)
 *   - 'math'            (Mathematical formula or equation)
 *
 * @module selection/classifier
 */

import { isInsideCodeBlock } from './codeSelector.js';
import { isInsideMathBlock } from './mathSelector.js';

/**
 * Common technical terminology glossary for fast semantic detection.
 * Set of lowercase terms for exact/word boundary matching.
 */
const TECHNICAL_TERMS = new Set([
  'polymorphism', 'concurrency', 'idempotency', 'memoization', 'closure',
  'recursion', 'monad', 'backpressure', 'deadlock', 'race condition',
  'asynchronous', 'vector embeddings', 'attention mechanism', 'transformer',
  'tokenization', 'cosine similarity', 'cross-entropy', 'backpropagation',
  'gradient descent', 'garbage collection', 'reconciliation', 'virtual dom',
  'shadow dom', 'event loop', 'content security policy', 'tree shaking',
  'hydration', 'immutability', 'hash table', 'binary search', 'microservice',
  'dependency injection', 'inversion of control', 'distributed consensus',
  'eventual consistency', 'cap theorem', 'raft consensus', 'paxos',
  'two-phase commit', 'bloom filter', 'trie', 'lru cache', 'debounce',
  'throttle', 'currying', 'higher-order function', 'pure function',
  'side effect', 'tail call optimization', 'lexical scope', 'hoisting',
  'prototypal inheritance', 'duck typing', 'reflection', 'metaprogramming',
  'generics', 'covariance', 'contravariance', 'type inference',
  'abstract syntax tree', 'just-in-time compilation', 'ahead-of-time',
  'web worker', 'service worker', 'manifest v3', 'service mesh',
  'kubernetes', 'docker', 'containerization', 'load balancing',
  'reverse proxy', 'zero-trust', 'public key infrastructure', 'oauth',
  'json web token', 'rate limiting', 'circuit breaker', 'graphql',
  'restful', 'grpc', 'websocket', 'server-sent events', 'webrtc',
]);

/**
 * Common abbreviations and acronyms in software & technology.
 */
const KNOWN_ABBREVIATIONS = new Set([
  'API', 'DOM', 'HTML', 'CSS', 'JSON', 'REST', 'GraphQL', 'SQL',
  'JWT', 'URL', 'URI', 'HTTP', 'HTTPS', 'CPU', 'GPU', 'TPU',
  'UUID', 'SDK', 'CLI', 'SPA', 'PWA', 'SSR', 'SSG', 'DOMRect',
  'MV3', 'MV2', 'LLM', 'AI', 'ML', 'NLP', 'CORS', 'CSP', 'XSS',
  'CSRF', 'DDOS', 'SEO', 'RPC', 'IPC', 'TCP', 'UDP', 'IP',
  'DNS', 'SSH', 'TLS', 'SSL', 'CI', 'CD', 'UI', 'UX', 'SaaS',
  'PaaS', 'IaaS', 'DB', 'ORM', 'RDBMS', 'ACID', 'BASE', 'UUIDv4',
]);

/**
 * Check if a string is an abbreviation or acronym.
 * @param {string} text
 * @returns {boolean}
 */
export function isAbbreviation(text) {
  if (!text) return false;
  const trimmed = text.trim();

  // Explicit check against known set
  if (KNOWN_ABBREVIATIONS.has(trimmed)) return true;

  // Dotted abbreviations like "e.g.", "i.e.", "etc.", "et al."
  if (/^(?:e\.g\.|i\.e\.|etc\.|et\s+al\.|vs\.|v\.s\.)$/i.test(trimmed)) {
    return true;
  }

  // All uppercase 2-6 letter string (e.g. "DOM", "API", "MV3", "APIs")
  if (/^[A-Z0-9]{2,6}s?$/.test(trimmed)) {
    // Exclude common all-caps English words that aren't technical acronyms
    const excludedWords = new Set(['AND', 'THE', 'FOR', 'NOT', 'BUT', 'CAN', 'ALL', 'GET', 'SET', 'OUT', 'NEW']);
    if (excludedWords.has(trimmed)) return false;
    return true;
  }

  return false;
}

/**
 * Check if a string is technical terminology or an identifier.
 * @param {string} text
 * @returns {boolean}
 */
export function isTechnicalTerminology(text) {
  if (!text) return false;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Known glossary term
  if (TECHNICAL_TERMS.has(lower)) return true;

  // camelCase identifier: e.g. useMemo, addEventListener, getBoundingClientRect
  if (/^[a-z]+[A-Z0-9][a-zA-Z0-9]*$/.test(trimmed) && trimmed.length >= 3) {
    return true;
  }

  // PascalCase identifier / class: e.g. SelectionSnapshot, MutationObserver
  if (/^[A-Z][a-z0-9]+[A-Z0-9][a-zA-Z0-9]*$/.test(trimmed)) {
    return true;
  }

  // snake_case identifier: e.g. selection_start, learning_rate, model_dump
  if (/^[a-z][a-z0-9]*_[a-z0-9_]+$/.test(trimmed)) {
    return true;
  }

  // Member access / dot notation: e.g. document.activeElement, Array.prototype.map
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)+$/.test(trimmed)) {
    return true;
  }

  // Common CSS property (kebab-case in tech context)
  if (/^(?:z-index|pointer-events|content-visibility|box-sizing|font-family|background-color)$/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Heuristic check if text looks like programming code syntax.
 * @param {string} text
 * @returns {boolean}
 */
export function hasCodeSyntax(text) {
  if (!text) return false;
  const trimmed = text.trim();

  // Multi-line code patterns
  if (trimmed.includes('\n')) {
    // Lines starting with indentation and containing programming tokens
    const codeLikeLines = trimmed.split('\n').filter((l) =>
      /^\s{2,}/.test(l) || /[;{}()\[\]=><]/.test(l) || /^\s*(?:import|export|const|let|var|function|return|def|class|if|else)\b/.test(l)
    );
    if (codeLikeLines.length >= 2) return true;
  }

  // Single-line code patterns
  const codePatterns = [
    /^\s*(?:const|let|var)\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*=/,
    /^\s*function(?:\s+[a-zA-Z_$][a-zA-Z0-9_$]*)?\s*\(/,
    /^\s*def\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(/,
    /^\s*(?:import|export)\s+.+from\s+['"]/,
    /=>\s*\{?/,
    /console\.(?:log|warn|error|info)\s*\(/,
    /;\s*$/,
    /^\s*<\w+.*?>.*<\/\w+>\s*$/,
    /^\s*(?:return|throw)\s+[a-zA-Z0-9_$]+;?$/,
    /^\s*SELECT\s+.+\s+FROM\s+/i,
  ];

  for (const pattern of codePatterns) {
    if (pattern.test(trimmed)) return true;
  }

  return false;
}

/**
 * Heuristic check if text looks like a mathematical expression.
 * @param {string} text
 * @returns {boolean}
 */
export function hasMathSyntax(text) {
  if (!text) return false;
  const trimmed = text.trim();

  // TeX command patterns: e.g. \frac, \sum, \int, \sqrt, \alpha, \partial
  // Note: in TeX, commands are followed by non-alpha characters (e.g. \int_0, \sum^n, \frac{a}{b})
  if (/\\(?:frac|sum|int|sqrt|alpha|beta|gamma|delta|theta|lambda|sigma|partial|infty|times|cdot|le|ge|neq|in|forall|exists|approx)(?:[^a-zA-Z]|$)/.test(trimmed)) {
    return true;
  }

  // Math delimiters: $...$, $$...$$, \(...\), \[...\]
  if (/^\${1,2}.+\${1,2}$/.test(trimmed) || /^\\\(.+\\\)$/.test(trimmed) || /^\\\[.+\\\]$/.test(trimmed)) {
    return true;
  }

  // Common equation patterns: e.g. "f(x) = x^2 + 1", "E = mc^2"
  if (/^[a-zA-Z]\([a-zA-Z0-9,\s]+\)\s*=/.test(trimmed) && /[\^+\-*/]/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Classify the content type of a selection.
 *
 * @param {string} rawText - Unprocessed or cleaned selection text
 * @param {Element|null} [anchorElement] - DOM element where selection occurred
 * @param {string} [strategy] - Selection capture strategy (input, shadow, etc.)
 * @returns {'general_text'|'programming_code'|'technical_terminology'|'mathematical_expression'|'abbreviation'|'other'}
 */
export function classifyContentType(rawText, anchorElement = null, strategy = 'standard') {
  if (!rawText || typeof rawText !== 'string') {
    return 'other';
  }

  const trimmed = rawText.trim();
  if (trimmed.length === 0) {
    return 'other';
  }

  // 1. Math check: inside math container or contains TeX syntax
  if (isInsideMathBlock(anchorElement) || hasMathSyntax(trimmed)) {
    return 'mathematical_expression';
  }

  // 2. Code check: inside code container or strong code syntax
  if (isInsideCodeBlock(anchorElement) || hasCodeSyntax(trimmed)) {
    return 'programming_code';
  }

  // 3. Abbreviation check: 2-6 uppercase acronyms or dotted abbreviations
  if (isAbbreviation(trimmed)) {
    return 'abbreviation';
  }

  // 4. Technical terminology check: identifiers, camelCase, CS concepts
  if (isTechnicalTerminology(trimmed)) {
    return 'technical_terminology';
  }

  // 5. General text: prose, words, sentences, paragraphs
  // Must contain alphabetic characters
  if (/[a-zA-Z\u00C0-\u024F]/.test(trimmed)) {
    return 'general_text';
  }

  // 6. Fallback: symbols, numbers alone, or miscellaneous
  return 'other';
}

/**
 * Classify the structural selection type.
 *
 * @param {string} text - Cleaned selection text
 * @param {string} contentType - Classified content type
 * @param {string} [blockText] - Optional enclosing block/paragraph text
 * @returns {'word'|'sentence'|'paragraph'|'multi_paragraph'|'code'|'math'}
 */
export function classifySelectionType(text, contentType, blockText = '') {
  if (!text || typeof text !== 'string') {
    return 'word';
  }

  const trimmed = text.trim();

  // If content is code or math, structural selection maps directly
  if (contentType === 'programming_code') {
    return 'code';
  }

  if (contentType === 'mathematical_expression') {
    return 'math';
  }

  // Check for multi-paragraph selection: 2+ newlines
  if (/\n\s*\n/.test(trimmed) || /\r\n\s*\r\n/.test(trimmed)) {
    return 'multi_paragraph';
  }

  // Word count heuristic
  const words = trimmed.split(/\s+/).filter(Boolean);

  // Single word selection
  if (words.length === 1) {
    return 'word';
  }

  // Paragraph check:
  // - Matches or substantially equals the enclosing block text
  // - Or has > 25 words and multiple sentence endings
  // - Or exceeds 200 characters without blank lines
  const sentenceCount = (trimmed.match(/[^.!?]+[.!?]+(?:\s+|$)/g) || []).length;

  if (
    (blockText && trimmed.length >= blockText.trim().length * 0.85 && words.length > 8) ||
    (words.length >= 25 && sentenceCount >= 2) ||
    trimmed.length > 250
  ) {
    return 'paragraph';
  }

  // Default for multi-word phrases, clauses, or single sentences
  return 'sentence';
}
