/**
 * Curio — Unit Tests for Floating Overlay Positioning & Mock Explainer Engine
 *
 * Validates:
 *   - Viewport boundary collision avoidance and flip logic
 *   - Horizontal coordinate clamping
 *   - Centering fallback when selection rect is missing/empty
 *   - Drag boundary constraints
 *   - Multi-depth explanation generation (Simple, Intermediate, Advanced)
 *   - Content-type handling (Code, Math, Concepts)
 *
 * Run: npm test
 */

import { strict as assert } from 'node:assert';
import { describe, it, beforeEach } from 'node:test';
import {
  calculateOverlayPosition,
  clampDragPosition,
} from '../../src/content/overlay/positioning.js';
import {
  generateMockExplanation,
} from '../../src/content/overlay/mockExplainer.js';

describe('Floating Overlay Positioning Engine', () => {
  beforeEach(() => {
    // Mock browser window dimensions
    globalThis.window = {
      innerWidth: 1920,
      innerHeight: 1080,
    };
  });

  it('should place overlay below selection when vertical clearance is sufficient', () => {
    const selectionRect = {
      top: 100,
      bottom: 130,
      left: 300,
      right: 450,
      width: 150,
      height: 30,
    };

    const pos = calculateOverlayPosition(selectionRect, { width: 450, height: 500 });
    assert.equal(pos.placement, 'below');
    assert.equal(pos.top, 140); // 130 + 10 gap
    assert.equal(pos.left, 300);
  });

  it('should flip overlay above selection when space below is insufficient', () => {
    const selectionRect = {
      top: 900,
      bottom: 930,
      left: 300,
      right: 450,
      width: 150,
      height: 30,
    };

    const pos = calculateOverlayPosition(selectionRect, { width: 450, height: 500 });
    assert.equal(pos.placement, 'above');
    assert.ok(pos.top < 900, `Expected top < 900, got ${pos.top}`);
    assert.equal(pos.top, 900 - 10 - 500); // 390
  });

  it('should clamp left coordinate to prevent right edge overflow', () => {
    const selectionRect = {
      top: 200,
      bottom: 230,
      left: 1800,
      right: 1900,
      width: 100,
      height: 30,
    };

    const cardWidth = 450;
    const pos = calculateOverlayPosition(selectionRect, { width: cardWidth, height: 500 });
    const maxAllowedLeft = 1920 - cardWidth - 16;
    assert.equal(pos.left, maxAllowedLeft);
  });

  it('should clamp left coordinate to prevent left edge overflow', () => {
    const selectionRect = {
      top: 200,
      bottom: 230,
      left: -20,
      right: 50,
      width: 70,
      height: 30,
    };

    const pos = calculateOverlayPosition(selectionRect, { width: 450, height: 500 });
    assert.equal(pos.left, 16);
  });

  it('should center overlay in viewport when selection rect is null or zero-size', () => {
    const posNull = calculateOverlayPosition(null, { width: 400, height: 500 });
    assert.equal(posNull.placement, 'center');
    assert.equal(posNull.left, Math.round((1920 - 400) / 2));
    assert.equal(posNull.top, Math.round((1080 - 500) / 2));

    const posZero = calculateOverlayPosition(
      { top: 0, left: 0, width: 0, height: 0 },
      { width: 400, height: 500 }
    );
    assert.equal(posZero.placement, 'center');
  });

  it('should clamp dragged position within viewport bounds', () => {
    const cardSize = { width: 450, height: 500 };

    // Dragged too far top-left
    const clampedTopLeft = clampDragPosition({ top: -100, left: -50 }, cardSize);
    assert.equal(clampedTopLeft.top, 16);
    assert.equal(clampedTopLeft.left, 16);

    // Dragged too far bottom-right
    const clampedBottomRight = clampDragPosition({ top: 2000, left: 3000 }, cardSize);
    assert.equal(clampedBottomRight.top, 1080 - 500 - 16);
    assert.equal(clampedBottomRight.left, 1920 - 450 - 16);
  });
});

describe('Mock Explainer Engine', () => {
  it('should generate simple, intermediate, and advanced modes', () => {
    const context = {
      selectedText: 'memoization',
      contentType: 'prose',
      pageTitle: 'Performance in React',
      pageUrl: 'https://example.com/react',
    };

    for (const mode of ['simple', 'intermediate', 'advanced']) {
      const result = generateMockExplanation(context, mode);
      assert.equal(result.mode, mode);
      assert.ok(result.title.length > 0, 'Title should be populated');
      assert.ok(result.summary.length > 0, 'Summary should be populated');
      assert.ok(Array.isArray(result.keyPoints), 'Keypoints should be an array');
      assert.ok(result.keyPoints.length >= 2, 'Should have at least 2 key points');
    }
  });

  it('should detect code and provide syntax-highlighted codeExample', () => {
    const context = {
      selectedText: 'const total = items.reduce((acc, curr) => acc + curr.price, 0);',
      contentType: 'code',
      language: 'javascript',
    };

    const result = generateMockExplanation(context, 'intermediate');
    assert.ok(result.codeExample !== null, 'Code example should be generated');
    assert.equal(result.codeExample.language, 'javascript');
    assert.ok(result.codeExample.code.includes('items.reduce'));
  });

  it('should format mathematical expressions', () => {
    const context = {
      selectedText: 'E = mc^2',
      contentType: 'math',
    };

    const result = generateMockExplanation(context, 'intermediate');
    assert.equal(result.title, 'Mathematical Expression');
    assert.ok(result.codeExample !== null);
    assert.equal(result.codeExample.language, 'latex');
  });

  it('should include deep dive internal mechanics in advanced mode', () => {
    const context = {
      selectedText: 'async function fetchData() { await fetch("/api"); }',
      contentType: 'code',
      language: 'javascript',
    };

    const result = generateMockExplanation(context, 'advanced');
    assert.equal(result.mode, 'advanced');
    assert.ok(result.deepDive !== null, 'Advanced mode should include deep dive');
    assert.ok(result.deepDive.length > 0);
  });
});

