/**
 * Curio — Unit Tests for Selection Engine & Context Extraction
 *
 * These tests run in Node.js using a minimal DOM mock.
 * They validate the pure-logic components of the selection engine
 * without requiring a real browser.
 *
 * Run: node tests/unit/selection.test.js
 */

import { strict as assert } from 'node:assert';
import { describe, it, beforeEach } from 'node:test';
import { SelectionPayloadSchema } from '../../src/shared/types/index.js';
import {
  classifyContentType,
  classifySelectionType,
  isAbbreviation,
  isTechnicalTerminology,
} from '../../src/content/selection/classifier.js';

// ─── Test Helpers: Minimal DOM Mocks ──────────────────────────────────

// We cannot import browser modules directly in Node, so we test
// the pure-function logic by importing specific submodules.
// For the code selector and math selector, the core logic is pure string
// processing which we can test directly.

// ─── Code Selector Tests ──────────────────────────────────────────────

// Inline the pure functions for testability
function normalizeCodeSelection(rawText) {
  if (!rawText) return '';
  let cleaned = rawText;
  const lines = cleaned.split('\n');

  if (lines.length > 1) {
    const lineNumPattern = /^\s*(\d+)\s{1,4}/;
    let lineNumCount = 0;
    for (const line of lines) {
      if (line.trim() === '') continue;
      if (lineNumPattern.test(line)) lineNumCount++;
    }
    const nonEmptyLines = lines.filter((l) => l.trim() !== '').length;
    if (nonEmptyLines > 0 && lineNumCount / nonEmptyLines > 0.6) {
      cleaned = lines
        .map((line) => {
          if (line.trim() === '') return '';
          return line.replace(lineNumPattern, '');
        })
        .join('\n');
    }
  }

  const tabLines = cleaned.split('\n');
  const tabNumPattern = /^\d+\t/;
  const tabNumCount = tabLines.filter((l) => l.trim() && tabNumPattern.test(l)).length;
  const tabNonEmpty = tabLines.filter((l) => l.trim()).length;
  if (tabNonEmpty > 0 && tabNumCount / tabNonEmpty > 0.6) {
    cleaned = tabLines
      .map((line) => line.replace(tabNumPattern, ''))
      .join('\n');
  }

  cleaned = cleaned
    .replace(/^Copy(?: to clipboard)?$/gm, '')
    .replace(/^\s*Copied!\s*$/gm, '');

  cleaned = cleaned
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
}

function normalizeProseText(text) {
  return text
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function detectCodeLanguageFromClassName(className) {
  if (!className || typeof className !== 'string') return null;
  const langMatch = className.match(/(?:language|lang)-(\w[\w+#.-]*)/i);
  if (langMatch) return langMatch[1].toLowerCase();
  const hljsMatch = className.match(/\bhljs\s+(\w+)/i);
  if (hljsMatch) return hljsMatch[1].toLowerCase();
  return null;
}

function extractEnclosingSentence(selectedText, paragraphText) {
  if (!paragraphText || !selectedText) return '';
  const normalizedPara = paragraphText.replace(/\s+/g, ' ');
  const normalizedSel = selectedText.replace(/\s+/g, ' ').trim();
  const sentences = (normalizedPara.match(/[^.!?]+(?:[.!?]+(?:\s+|$)|$)/g) || [])
    .map((s) => s.trim())
    .filter(Boolean);
  for (const sentence of sentences) {
    if (sentence.includes(normalizedSel) || normalizedSel.includes(sentence)) {
      return sentence;
    }
  }
  const idx = normalizedPara.indexOf(normalizedSel);
  if (idx !== -1) {
    const start = Math.max(0, idx - 100);
    const end = Math.min(normalizedPara.length, idx + normalizedSel.length + 100);
    return normalizedPara.substring(start, end).trim();
  }
  return '';
}

function sanitizeUrl(url) {
  try {
    const parsed = new URL(url);
    const sensitiveParams = [
      'token', 'auth', 'key', 'secret', 'session', 'sid',
      'password', 'passwd', 'access_token', 'refresh_token',
      'api_key', 'apikey', 'jwt',
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'mc_eid', 'mc_cid',
    ];
    for (const param of sensitiveParams) {
      parsed.searchParams.delete(param);
    }
    if (parsed.hash && parsed.hash.length > 30) {
      parsed.hash = '';
    }
    return parsed.toString();
  } catch (_e) {
    return url.split('?')[0].split('#')[0];
  }
}

// ─── Test Suite ───────────────────────────────────────────────────────

describe('Code Selection Normalization', () => {
  it('should strip leading line numbers from code', () => {
    const input = '  1  const x = 1;\n  2  const y = 2;\n  3  return x + y;';
    const result = normalizeCodeSelection(input);
    assert.ok(!result.match(/^\s*\d+\s{2,}/m), 'Line numbers should be stripped');
    assert.ok(result.includes('const x = 1;'));
    assert.ok(result.includes('return x + y;'));
  });

  it('should strip tab-separated line numbers', () => {
    const input = '1\tconst x = 1;\n2\treturn x;';
    const result = normalizeCodeSelection(input);
    assert.equal(result, 'const x = 1;\nreturn x;');
  });

  it('should remove copy button artifacts', () => {
    const input = 'Copy to clipboard\nconst x = 1;\nreturn x;\nCopied!';
    const result = normalizeCodeSelection(input);
    assert.ok(!result.includes('Copy to clipboard'));
    assert.ok(!result.includes('Copied!'));
    assert.ok(result.includes('const x = 1;'));
  });

  it('should collapse excessive blank lines', () => {
    const input = 'const x = 1;\n\n\n\n\nreturn x;';
    const result = normalizeCodeSelection(input);
    assert.ok(!result.includes('\n\n\n'), 'Should not have 3+ consecutive newlines');
    assert.ok(result.includes('const x = 1;'));
    assert.ok(result.includes('return x;'));
  });

  it('should preserve code without line numbers', () => {
    const input = 'function hello() {\n  console.log("world");\n}';
    const result = normalizeCodeSelection(input);
    assert.equal(result, input);
  });

  it('should handle empty input', () => {
    assert.equal(normalizeCodeSelection(''), '');
    assert.equal(normalizeCodeSelection(null), '');
  });

  it('should handle single line code', () => {
    const input = 'const x = 42;';
    const result = normalizeCodeSelection(input);
    assert.equal(result, 'const x = 42;');
  });
});

describe('Language Detection from CSS Classes', () => {
  it('should detect language-xxx pattern', () => {
    assert.equal(detectCodeLanguageFromClassName('language-python'), 'python');
    assert.equal(detectCodeLanguageFromClassName('language-typescript'), 'typescript');
    assert.equal(detectCodeLanguageFromClassName('language-c++'), 'c++');
  });

  it('should detect lang-xxx pattern', () => {
    assert.equal(detectCodeLanguageFromClassName('lang-go'), 'go');
  });

  it('should detect hljs pattern', () => {
    assert.equal(detectCodeLanguageFromClassName('hljs javascript'), 'javascript');
  });

  it('should return null for no language', () => {
    assert.equal(detectCodeLanguageFromClassName('some-other-class'), null);
    assert.equal(detectCodeLanguageFromClassName(''), null);
    assert.equal(detectCodeLanguageFromClassName(null), null);
  });
});

describe('Prose Text Normalization', () => {
  it('should collapse whitespace runs within lines', () => {
    const input = 'Hello    world   foo';
    assert.equal(normalizeProseText(input), 'Hello world foo');
  });

  it('should preserve paragraph breaks', () => {
    const input = 'Paragraph one.\n\nParagraph two.';
    assert.equal(normalizeProseText(input), 'Paragraph one.\n\nParagraph two.');
  });

  it('should collapse 3+ newlines to 2', () => {
    const input = 'First.\n\n\n\nSecond.';
    assert.equal(normalizeProseText(input), 'First.\n\nSecond.');
  });

  it('should remove zero-width characters', () => {
    const input = 'Hello\u200Bworld\u200C\u200D\uFEFF';
    assert.equal(normalizeProseText(input), 'Helloworld');
  });

  it('should trim leading and trailing whitespace', () => {
    const input = '   Hello world   ';
    assert.equal(normalizeProseText(input), 'Hello world');
  });
});

describe('Sentence Extraction', () => {
  it('should extract the sentence containing the selection', () => {
    const para = 'The quick brown fox jumps. Over the lazy dog. And the cat meows.';
    const result = extractEnclosingSentence('lazy dog', para);
    assert.ok(result.includes('lazy dog'), `Expected sentence with "lazy dog", got: "${result}"`);
  });

  it('should handle single sentence paragraphs', () => {
    const para = 'This is the only sentence here.';
    const result = extractEnclosingSentence('only sentence', para);
    assert.ok(result.includes('only sentence'));
  });

  it('should handle selection spanning sentence boundary', () => {
    const para = 'First sentence. Second sentence. Third sentence.';
    const result = extractEnclosingSentence('Second sentence', para);
    assert.ok(result.includes('Second sentence'));
  });

  it('should return empty for missing selection', () => {
    assert.equal(extractEnclosingSentence('', 'Some text.'), '');
    assert.equal(extractEnclosingSentence('foo', ''), '');
  });
});

describe('URL Sanitization', () => {
  it('should remove auth tokens from query params', () => {
    const url = 'https://example.com/page?id=123&token=secret&name=foo';
    const result = sanitizeUrl(url);
    assert.ok(!result.includes('token=secret'), 'Token should be removed');
    assert.ok(result.includes('id=123'), 'Non-sensitive params should remain');
    assert.ok(result.includes('name=foo'));
  });

  it('should remove tracking parameters', () => {
    const url = 'https://example.com/article?utm_source=twitter&utm_medium=social&page=5';
    const result = sanitizeUrl(url);
    assert.ok(!result.includes('utm_source'));
    assert.ok(!result.includes('utm_medium'));
    assert.ok(result.includes('page=5'));
  });

  it('should remove long hashes (likely tokens)', () => {
    const url = 'https://example.com/page#aVeryLongBase64TokenThatIsMoreThan30CharactersLong';
    const result = sanitizeUrl(url);
    assert.ok(!result.includes('aVeryLong'), 'Long hash should be removed');
  });

  it('should preserve normal short hashes', () => {
    const url = 'https://example.com/page#section-1';
    const result = sanitizeUrl(url);
    assert.ok(result.includes('#section-1'));
  });

  it('should handle malformed URLs gracefully', () => {
    const url = 'not-a-valid-url?foo=bar#hash';
    const result = sanitizeUrl(url);
    assert.equal(result, 'not-a-valid-url');
  });

  it('should remove API key params', () => {
    const url = 'https://api.example.com/v1/data?api_key=sk-abc123&format=json';
    const result = sanitizeUrl(url);
    assert.ok(!result.includes('api_key'));
    assert.ok(result.includes('format=json'));
  });
});

describe('Selection Validation Logic', () => {
  function validateSelection(text) {
    const MIN = 1;
    const MAX = 15000;
    if (!text || text.trim().length < MIN) return { valid: false, reason: 'empty' };
    if (text.length > MAX) return { valid: false, reason: 'too_large' };
    if (/^[\s\u200B\u200C\u200D\uFEFF]+$/.test(text)) return { valid: false, reason: 'whitespace_only' };
    return { valid: true };
  }

  it('should reject empty text', () => {
    assert.deepEqual(validateSelection(''), { valid: false, reason: 'empty' });
    assert.deepEqual(validateSelection(null), { valid: false, reason: 'empty' });
    assert.deepEqual(validateSelection(undefined), { valid: false, reason: 'empty' });
  });

  it('should reject whitespace-only text', () => {
    assert.deepEqual(validateSelection('   \n\t  '), { valid: false, reason: 'empty' });
    assert.deepEqual(validateSelection('\u200B\u200C'), { valid: false, reason: 'whitespace_only' });
  });

  it('should reject excessively long text', () => {
    const long = 'x'.repeat(20000);
    assert.deepEqual(validateSelection(long), { valid: false, reason: 'too_large' });
  });

  it('should accept valid text', () => {
    assert.deepEqual(validateSelection('Hello world'), { valid: true });
    assert.deepEqual(validateSelection('x'), { valid: true });
  });

  it('should accept code snippets', () => {
    assert.deepEqual(validateSelection('const x = 1;'), { valid: true });
  });
});

describe('SelectionPayload Zod Schema Validation', () => {
  it('should successfully parse a rich payload from content script', () => {
    const rawPayload = {
      selectedText: 'useMemo(() => compute(), [dep])',
      contentType: 'code',
      language: 'javascript',
      sentence: 'Hooks like useMemo cache expensive calculations.',
      paragraph: 'In React, optimizing re-renders is crucial. Hooks like useMemo cache expensive calculations.',
      precedingText: 'In React, optimizing re-renders is crucial. ',
      succeedingText: ' Use it wisely.',
      nearestHeading: 'React Performance Optimization',
      pageTitle: 'React Hooks Guide',
      pageUrl: 'https://react.dev/reference/react/useMemo',
      boundingBox: {
        top: 100,
        left: 200,
        bottom: 150,
        right: 400,
        width: 200,
        height: 50,
      },
      nodeType: 'code',
      timestamp: Date.now(),
    };

    const parsed = SelectionPayloadSchema.parse(rawPayload);
    assert.equal(parsed.selectedText, rawPayload.selectedText);
    assert.equal(parsed.contentType, 'code');
    assert.equal(parsed.language, 'javascript');
    assert.equal(parsed.sentence, rawPayload.sentence);
    assert.equal(parsed.nearestHeading, 'React Performance Optimization');
  });

  it('should apply defaults for optional context fields', () => {
    const minimalPayload = {
      selectedText: 'Antigravity',
    };

    const parsed = SelectionPayloadSchema.parse(minimalPayload);
    assert.equal(parsed.selectedText, 'Antigravity');
    assert.equal(parsed.contentType, 'prose');
    assert.equal(parsed.language, undefined);
    assert.equal(parsed.sentence, '');
    assert.equal(parsed.nearestHeading, undefined);
    assert.equal(typeof parsed.timestamp, 'number');
  });

  it('should reject payload with empty selectedText', () => {
    assert.throws(() => {
      SelectionPayloadSchema.parse({ selectedText: '' });
    });
  });
});

describe('Content Type Classifier', () => {
  it('should classify programming code constructs', () => {
    assert.equal(classifyContentType('const x = 10;'), 'programming_code');
    assert.equal(classifyContentType('function calculateSum(a, b) {\n  return a + b;\n}'), 'programming_code');
    assert.equal(classifyContentType('import { useState } from "react";'), 'programming_code');
    assert.equal(classifyContentType('def process_stream(data):\n    pass'), 'programming_code');
    assert.equal(classifyContentType('SELECT * FROM users WHERE active = 1;'), 'programming_code');
  });

  it('should classify mathematical expressions', () => {
    assert.equal(classifyContentType('\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}'), 'mathematical_expression');
    assert.equal(classifyContentType('\\sum_{k=1}^\\infty \\frac{1}{k^2} = \\frac{\\pi^2}{6}'), 'mathematical_expression');
    assert.equal(classifyContentType('\\int_0^1 x^2 dx'), 'mathematical_expression');
    assert.equal(classifyContentType('$\\lambda = 42$'), 'mathematical_expression');
    assert.equal(classifyContentType('f(x) = x^2 + 2x - 1'), 'mathematical_expression');
  });

  it('should classify abbreviations and acronyms', () => {
    assert.equal(classifyContentType('API'), 'abbreviation');
    assert.equal(classifyContentType('DOM'), 'abbreviation');
    assert.equal(classifyContentType('JSON'), 'abbreviation');
    assert.equal(classifyContentType('GraphQL'), 'abbreviation');
    assert.equal(classifyContentType('MV3'), 'abbreviation');
    assert.equal(classifyContentType('e.g.'), 'abbreviation');
    assert.equal(classifyContentType('i.e.'), 'abbreviation');
  });

  it('should classify technical terminology and identifiers', () => {
    assert.equal(classifyContentType('useMemo'), 'technical_terminology');
    assert.equal(classifyContentType('addEventListener'), 'technical_terminology');
    assert.equal(classifyContentType('MutationObserver'), 'technical_terminology');
    assert.equal(classifyContentType('SelectionSnapshot'), 'technical_terminology');
    assert.equal(classifyContentType('polymorphism'), 'technical_terminology');
    assert.equal(classifyContentType('concurrency'), 'technical_terminology');
    assert.equal(classifyContentType('memoization'), 'technical_terminology');
    assert.equal(classifyContentType('window.getSelection'), 'technical_terminology');
    assert.equal(classifyContentType('selection_start'), 'technical_terminology');
  });

  it('should classify general text and prose', () => {
    assert.equal(classifyContentType('The quick brown fox jumps over the lazy dog.'), 'general_text');
    assert.equal(classifyContentType('Modern web development requires careful attention to performance and accessibility.'), 'general_text');
    assert.equal(classifyContentType('Hello world'), 'general_text');
  });

  it('should classify unclassified or symbolic content as other', () => {
    assert.equal(classifyContentType('---===---'), 'other');
    assert.equal(classifyContentType('!@#$%^&*()'), 'other');
    assert.equal(classifyContentType(''), 'other');
    assert.equal(classifyContentType(null), 'other');
  });
});

describe('Selection Type Classifier', () => {
  it('should classify single word selections', () => {
    assert.equal(classifySelectionType('map', 'general_text'), 'word');
    assert.equal(classifySelectionType('useMemo', 'technical_terminology'), 'word');
    assert.equal(classifySelectionType('API', 'abbreviation'), 'word');
    assert.equal(classifySelectionType('recursion', 'technical_terminology'), 'word');
  });

  it('should classify complete sentence selections', () => {
    const sentence = 'Distributed systems require robust consensus algorithms like Raft or Paxos.';
    assert.equal(classifySelectionType(sentence, 'general_text'), 'sentence');
    assert.equal(classifySelectionType('This is a short clause', 'general_text'), 'sentence');
  });

  it('should classify cohesive paragraph selections', () => {
    const paragraph =
      'Large language models have evolved from simple statistical n-gram representations into deep autoregressive transformers. By training on web-scale text corpora with self-supervised next-token prediction, they capture intricate syntactic and semantic relationships across domains. Recent fine-tuning techniques allow these models to adhere to instructions and act as reasoning agents.';
    assert.equal(classifySelectionType(paragraph, 'general_text'), 'paragraph');
  });

  it('should classify multi-paragraph selections', () => {
    const multiPara =
      'First paragraph discussing client-side caching strategies in web applications.\n\nSecond paragraph outlining invalidation mechanics and edge storage considerations.';
    assert.equal(classifySelectionType(multiPara, 'general_text'), 'multi_paragraph');
  });

  it('should classify code selections', () => {
    assert.equal(classifySelectionType('const x = 42;\nreturn x;', 'programming_code'), 'code');
  });

  it('should classify math selections', () => {
    assert.equal(classifySelectionType('\\sum_{i=0}^n x_i', 'mathematical_expression'), 'math');
  });
});

describe('Standardized SelectionSnapshot Interface Schema', () => {
  it('should parse the standardized selection object with all required properties', () => {
    const standardized = {
      selectedText: 'useMemo',
      surroundingSentence: 'In React, hooks like useMemo memoize expensive computations.',
      surroundingParagraph: 'In React, optimizing performance is crucial. In React, hooks like useMemo memoize expensive computations. This prevents unnecessary re-renders on state changes.',
      pageTitle: 'React API Reference',
      pageUrl: 'https://react.dev/reference/react/useMemo',
      contentType: 'technical_terminology',
      selectionType: 'word',
      selectionRect: {
        top: 150,
        left: 220,
        width: 80,
        height: 20,
      },
      timestamp: 1700000000000,
    };

    const parsed = SelectionPayloadSchema.parse(standardized);

    // Verify standardized properties
    assert.equal(parsed.selectedText, 'useMemo');
    assert.equal(parsed.surroundingSentence, standardized.surroundingSentence);
    assert.equal(parsed.surroundingParagraph, standardized.surroundingParagraph);
    assert.equal(parsed.pageTitle, 'React API Reference');
    assert.equal(parsed.pageUrl, 'https://react.dev/reference/react/useMemo');
    assert.equal(parsed.contentType, 'technical_terminology');
    assert.equal(parsed.selectionType, 'word');
    assert.deepEqual(parsed.selectionRect, {
      top: 150,
      left: 220,
      width: 80,
      height: 20,
    });
    assert.equal(parsed.timestamp, 1700000000000);

    // Verify automatic backward-compatible aliases
    assert.equal(parsed.sentence, standardized.surroundingSentence);
    assert.equal(parsed.paragraph, standardized.surroundingParagraph);
    assert.equal(parsed.boundingBox.top, 150);
    assert.equal(parsed.boundingBox.left, 220);
    assert.equal(parsed.boundingBox.width, 80);
    assert.equal(parsed.boundingBox.height, 20);
  });

  it('should populate selectionRect from legacy boundingBox and vice-versa', () => {
    const legacyPayload = {
      selectedText: 'polymorphism',
      sentence: 'Polymorphism allows objects of different types to be treated uniformly.',
      paragraph: 'In object-oriented programming, polymorphism allows objects of different types to be treated uniformly.',
      boundingBox: {
        top: 50,
        left: 60,
        bottom: 80,
        right: 160,
        width: 100,
        height: 30,
      },
    };

    const parsed = SelectionPayloadSchema.parse(legacyPayload);
    assert.equal(parsed.surroundingSentence, legacyPayload.sentence);
    assert.equal(parsed.surroundingParagraph, legacyPayload.paragraph);
    assert.equal(parsed.selectionRect.top, 50);
    assert.equal(parsed.selectionRect.left, 60);
    assert.equal(parsed.selectionRect.width, 100);
    assert.equal(parsed.selectionRect.height, 30);
  });
});

// Run summary
console.log('\n✅ All unit test suites defined. Running via node:test...\n');

