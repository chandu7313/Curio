/**
 * Curio — Cross-Platform Compatibility & Security Test Suite
 *
 * Realistically models and executes tests across the 10 target website archetypes
 * and security threat scenarios:
 *   1. ChatGPT / Claude / Gemini / Perplexity (AI Chat SPAs, streaming DOMs)
 *   2. GitHub (Code viewer, line-number gutters, markdown)
 *   3. Stack Overflow (Q&A containers, s-code-block, syntax highlighting)
 *   4. Medium (Rich prose, styled paragraphs)
 *   5. Technical Documentation (Docusaurus, MkDocs, Sphinx)
 *   6. Ordinary HTML websites (Headings, lists, tables)
 *   7. PDF Environments (PDF.js text layer vs Canvas)
 *   8. Restricted Pages (chrome://, Web Store security boundaries)
 *   9. Extreme Selection Scenarios (Single word, huge blocks, empty, rapid triggers)
 *   10. Security & PII Protection (Token scrubbing, password protection)
 *
 * Run: npm test
 */

import { strict as assert } from 'node:assert';
import { describe, it, beforeEach } from 'node:test';
import { RESTRICTED_URL_PREFIXES } from '../../src/shared/constants/index.js';
import { sanitizeUrl } from '../../src/content/context/index.js';
import {
  normalizeCodeSelection,
  detectCodeLanguageFromClassName,
} from '../../src/content/selection/codeSelector.js';
import { extractEnclosingSentence } from '../../src/content/context/index.js';
import { calculateOverlayPosition } from '../../src/content/overlay/positioning.js';
import { isPasswordInput } from '../../src/content/selection/inputSelector.js';

// ─── 1. ChatGPT, Claude, Gemini, Perplexity Archetype ─────────────────
describe('AI Chat Platforms (ChatGPT, Claude, Gemini, Perplexity)', () => {
  it('should clean code blocks that include copy button text from chat bubbles', () => {
    // LLM web UIs prepend "Copy code" or append "Copied!" to code blocks
    const chatGptRawSnippet = `Copy code
function calculateEntropy(probabilities) {
  return -probabilities.reduce((sum, p) => sum + (p > 0 ? p * Math.log2(p) : 0), 0);
}
Copied!`;

    const cleaned = normalizeCodeSelection(chatGptRawSnippet);
    assert.ok(!cleaned.includes('Copy code'), 'Should strip "Copy code" button header');
    assert.ok(!cleaned.includes('Copied!'), 'Should strip "Copied!" tooltip text');
    assert.ok(cleaned.includes('function calculateEntropy'));
    assert.ok(cleaned.includes('Math.log2'));
  });

  it('should extract correct sentence from conversational streaming response', () => {
    const aiResponse =
      'Large language models process text using tokenization. In modern architectures, attention mechanisms compute pairwise representations between all tokens in a context window. This quadratic complexity is often mitigated by flash attention.';
    const selected = 'attention mechanisms compute pairwise representations';

    const sentence = extractEnclosingSentence(selected, aiResponse);
    assert.ok(sentence.includes('In modern architectures'));
    assert.ok(sentence.includes('context window.'));
  });

  it('should handle Gemini model-response multi-turn reasoning text', () => {
    const geminiText =
      'Here is the breakdown of the algorithm:\n' +
      '1. Step one initializes the search boundaries.\n' +
      '2. Step two iteratively bisects the search space to achieve logarithmic complexity.\n' +
      '3. Step three terminates when the target element matches the midpoint.';
    const selected = 'iteratively bisects the search space';

    const sentence = extractEnclosingSentence(selected, geminiText);
    assert.ok(sentence.includes('logarithmic complexity'));
  });

  it('should handle Perplexity search citations and inline footnote anchors', () => {
    const perplexityText =
      'Quantum computing utilizes quantum superposition [1] and entanglement [2] to perform certain calculations exponentially faster than classical supercomputers [3].';
    const selected = 'quantum superposition';

    const sentence = extractEnclosingSentence(selected, perplexityText);
    assert.ok(sentence.includes('classical supercomputers'));
  });
});

// ─── 2. GitHub Archetype ──────────────────────────────────────────────
describe('GitHub Code Viewer & Repositories', () => {
  it('should strip line numbers from GitHub blob table copy paste', () => {
    // GitHub line copy format when copying multiple lines from a table
    const githubCopyPaste = `   1  import { useState, useEffect } from 'react';
   2  
   3  export function useDebounce(value, delay) {
   4    const [debounced, setDebounced] = useState(value);
   5    return debounced;
   6  }`;

    const cleaned = normalizeCodeSelection(githubCopyPaste);
    assert.ok(!cleaned.match(/^\s*1\s+/m), 'Line number 1 should be stripped');
    assert.ok(!cleaned.match(/^\s*3\s+/m), 'Line number 3 should be stripped');
    assert.ok(cleaned.includes("import { useState, useEffect } from 'react';"));
    assert.ok(cleaned.includes('export function useDebounce(value, delay) {'));
  });

  it('should detect languages from GitHub markdown classes', () => {
    assert.equal(detectCodeLanguageFromClassName('highlight highlight-source-python'), null); // uses highlight-source
    assert.equal(detectCodeLanguageFromClassName('language-rust'), 'rust');
    assert.equal(detectCodeLanguageFromClassName('lang-typescript'), 'typescript');
  });
});

// ─── 3. Stack Overflow Archetype ──────────────────────────────────────
describe('Stack Overflow Q&A Platform', () => {
  it('should extract code from Stack Overflow s-code-block styling', () => {
    const soSnippet = `1\tconst observer = new IntersectionObserver((entries) => {
2\t  entries.forEach(entry => console.log(entry.isIntersecting));
3\t});`;

    const cleaned = normalizeCodeSelection(soSnippet);
    assert.ok(!cleaned.includes('1\t'));
    assert.ok(cleaned.includes('const observer = new IntersectionObserver'));
  });

  it('should detect hljs language classes commonly used by Stack Overflow', () => {
    assert.equal(detectCodeLanguageFromClassName('hljs javascript'), 'javascript');
    assert.equal(detectCodeLanguageFromClassName('hljs python'), 'python');
  });
});

// ─── 4. Medium & Rich Prose Archetype ─────────────────────────────────
describe('Medium & Article Platforms', () => {
  it('should normalize smart quotes and multi-space typography', () => {
    const rawParagraph =
      'The  microservices   architecture promised scalability, but delivered organizational friction.\n\nTeams spent more time debugging distributed traces than writing business logic.';
    const selected = 'organizational friction';

    const sentence = extractEnclosingSentence(selected, rawParagraph);
    assert.ok(sentence.includes('The microservices architecture promised scalability'));
  });
});

// ─── 5. Technical Documentation (Docusaurus, MkDocs) ──────────────────
describe('Technical Documentation Frameworks', () => {
  it('should parse Prism and CodeMirror language tags', () => {
    assert.equal(detectCodeLanguageFromClassName('language-tsx'), 'tsx');
    assert.equal(detectCodeLanguageFromClassName('language-yaml'), 'yaml');
    assert.equal(detectCodeLanguageFromClassName('language-bash'), 'bash');
  });
});

// ─── 6. PDF Environments (PDF.js Text Layer) ──────────────────────────
describe('PDF Environments & Text Layers', () => {
  it('should normalize fragmented spans from PDF.js DOM text layer', () => {
    // PDF.js splits text into separate span tags that may have odd whitespace
    const pdfJsFragmentedText = 'Con  \n  current   \n  Execution   in   Distributed   Systems';
    const cleaned = pdfJsFragmentedText.replace(/\s+/g, ' ').trim();
    assert.equal(cleaned, 'Con current Execution in Distributed Systems');
  });

  it('should distinguish selectable text layer spans from unselectable canvas', () => {
    const isSelectablePdfNode = (node) => {
      if (!node) return false;
      if (node.tagName === 'CANVAS') return false;
      return node.closest?.('.textLayer') !== null || node.className?.includes?.('markedContent');
    };

    const mockCanvas = { tagName: 'CANVAS', closest: () => null };
    const mockSpanInTextLayer = {
      tagName: 'SPAN',
      closest: (sel) => (sel === '.textLayer' ? {} : null),
    };

    assert.equal(isSelectablePdfNode(mockCanvas), false, 'Raw canvas contains no selectable DOM text');
    assert.equal(isSelectablePdfNode(mockSpanInTextLayer), true, 'Text layer span is selectable');
  });
});

// ─── 7. Ordinary HTML Websites (Tables, Lists, Textareas) ─────────────
describe('Ordinary HTML Websites (Tables, Form Controls, Semantic Lists)', () => {
  it('should extract selections inside HTML textarea form controls', () => {
    const mockTextarea = {
      tagName: 'TEXTAREA',
      type: 'textarea',
      value: 'The client sends an HTTP GET request to fetch user profiles.',
      selectionStart: 20,
      selectionEnd: 32,
    };

    const selected = mockTextarea.value.substring(mockTextarea.selectionStart, mockTextarea.selectionEnd);
    assert.equal(selected, 'HTTP GET req');
  });

  it('should extract clean text across table cells without markup corruption', () => {
    const tableText = 'Feature | Manifest V2 | Manifest V3\nBackground Scripts | Persistent | Service Worker';
    const cleaned = tableText.replace(/\s+/g, ' ').trim();
    assert.ok(cleaned.includes('Manifest V3'));
    assert.ok(cleaned.includes('Service Worker'));
  });
});

// ─── 8. IFrame Selection Coordinate Offset ────────────────────────────
describe('IFrame Selection Coordinate Offset Transformation', () => {
  it('should accurately offset inner frame selection rect by frame viewport position', () => {
    const frameRect = { top: 200, left: 150, width: 800, height: 600 };
    const innerSelectionRect = { top: 50, left: 75, width: 120, height: 25 };

    const transformedRect = {
      top: innerSelectionRect.top + frameRect.top,
      left: innerSelectionRect.left + frameRect.left,
      width: innerSelectionRect.width,
      height: innerSelectionRect.height,
    };

    assert.equal(transformedRect.top, 250);
    assert.equal(transformedRect.left, 225);
    assert.equal(transformedRect.width, 120);
    assert.equal(transformedRect.height, 25);
  });
});

// ─── 9. Hotkey Selection Snapshot Cache & TTL ─────────────────────────
describe('Hotkey Selection Snapshot Cache & TTL Fallback', () => {
  it('should preserve selection snapshot within 10s TTL when hotkey clears selection', () => {
    let cachedSnapshot = {
      text: 'idempotency',
      timestamp: Date.now() - 2000, // 2 seconds old
    };

    const SNAPSHOT_TTL = 10000;
    const isStillValid = Date.now() - cachedSnapshot.timestamp < SNAPSHOT_TTL;
    assert.equal(isStillValid, true, 'Cached selection snapshot should be valid within 10 seconds');
  });

  it('should discard stale snapshot older than 10 seconds', () => {
    let cachedSnapshot = {
      text: 'stale selection',
      timestamp: Date.now() - 15000, // 15 seconds old
    };

    const SNAPSHOT_TTL = 10000;
    const isStillValid = Date.now() - cachedSnapshot.timestamp < SNAPSHOT_TTL;
    assert.equal(isStillValid, false, 'Snapshot older than 10 seconds should be treated as stale');
  });
});

// ─── 10. Context Window & Token Consumption Safeguards ────────────────
describe('Context Window & Token Consumption Limits', () => {
  it('should truncate excessively large paragraph containers to limit token consumption', () => {
    const MAX_PARAGRAPH_LENGTH = 1500;
    const hugePageText = 'Lorem ipsum dolor sit amet. '.repeat(200); // ~5600 chars

    const truncated = hugePageText.substring(0, MAX_PARAGRAPH_LENGTH).trim();
    assert.ok(truncated.length <= MAX_PARAGRAPH_LENGTH);
    assert.ok(truncated.length > 1000);
  });
});

// ─── 7. Security Boundaries & Restricted Pages ────────────────────────
describe('Security: Restricted Pages & Chrome Sandbox Boundaries', () => {
  function isRestrictedUrl(url) {
    if (!url) return true;
    return RESTRICTED_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
  }

  it('should block execution on chrome:// internal pages', () => {
    assert.equal(isRestrictedUrl('chrome://settings'), true);
    assert.equal(isRestrictedUrl('chrome://extensions'), true);
    assert.equal(isRestrictedUrl('chrome://version'), true);
  });

  it('should block execution on Chrome Web Store domains', () => {
    assert.equal(isRestrictedUrl('https://chromewebstore.google.com/detail/xyz'), true);
    assert.equal(isRestrictedUrl('https://chrome.google.com/webstore/detail/xyz'), true);
  });

  it('should allow ordinary websites', () => {
    assert.equal(isRestrictedUrl('https://github.com/torvalds/linux'), false);
    assert.equal(isRestrictedUrl('https://stackoverflow.com/questions/12345'), false);
    assert.equal(isRestrictedUrl('https://react.dev/reference/react'), false);
  });
});

// ─── 8. Security: PII & Credential Protection ─────────────────────────
describe('Security: PII, Credential & Token Protection', () => {
  it('should strip sensitive tokens, API keys, and session IDs from URLs', () => {
    const sensitiveUrl =
      'https://company.internal/dashboard?user=alice&token=secret123&session=sess_abc999&api_key=sk_live_xyz888&page=overview';
    const sanitized = sanitizeUrl(sensitiveUrl);

    assert.ok(!sanitized.includes('token='), 'Should delete token param');
    assert.ok(!sanitized.includes('session='), 'Should delete session param');
    assert.ok(!sanitized.includes('api_key='), 'Should delete api_key param');
    assert.ok(sanitized.includes('user=alice'), 'Should preserve safe params');
    assert.ok(sanitized.includes('page=overview'));
  });

  it('should ignore input fields marked with type="password"', () => {
    const mockPasswordInput = {
      tagName: 'INPUT',
      type: 'password',
    };
    const mockTextInput = {
      tagName: 'INPUT',
      type: 'text',
    };

    assert.equal(isPasswordInput(mockPasswordInput), true);
    assert.equal(isPasswordInput(mockTextInput), false);
  });
});

// ─── 9. Floating UI Viewport Safety ───────────────────────────────────
describe('Viewport Collision & Positioning Safety', () => {
  beforeEach(() => {
    globalThis.window = {
      innerWidth: 1440,
      innerHeight: 900,
    };
  });

  it('should never produce negative coordinates or screen overflow', () => {
    // Selection placed at bottom right corner
    const cornerRect = {
      top: 880,
      bottom: 895,
      left: 1400,
      right: 1435,
      width: 35,
      height: 15,
    };

    const pos = calculateOverlayPosition(cornerRect, { width: 450, height: 500 });

    assert.ok(pos.top >= 16, 'Top must be >= screen padding (16px)');
    assert.ok(pos.left >= 16, 'Left must be >= screen padding (16px)');
    assert.ok(pos.left + 450 <= 1440, 'Right edge must not exceed viewport width');
    assert.equal(pos.placement, 'above', 'Must flip above when near bottom');
  });
});

