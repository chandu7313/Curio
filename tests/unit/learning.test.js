/**
 * Curio — Unit Tests for Personal Learning Intelligence & Knowledge Graph
 *
 * Validates:
 *   - Semantic relationship mapping (e.g. Python map -> Iterables, Lambdas, Comprehensions)
 *   - Category inference (React, Python, JS, Architecture, etc.)
 *   - Glossary persistence, incremental exploration count, and understanding levels
 *   - Multi-criteria glossary search and filtering
 *   - Learning progress statistics calculation
 *   - Privacy-respecting export and erasure
 *
 * Run: npm test
 */

import { strict as assert } from 'node:assert';
import { describe, it, beforeEach } from 'node:test';
import {
  getRelatedConcepts,
  inferConceptCategory,
} from '../../src/shared/services/knowledgeGraph.js';
import {
  recordConceptExploration,
  getGlossary,
  searchGlossary,
  updateUnderstandingLevel,
  toggleSaveConcept,
  updateConceptNotes,
  deleteConcept,
  getLearningStats,
  exportLearningData,
  clearLearningData,
} from '../../src/shared/services/learningService.js';

describe('Knowledge Graph & Semantic Connections', () => {
  it('should return curated relationships for Python map()', () => {
    const relations = getRelatedConcepts('Python map');
    assert.ok(Array.isArray(relations));
    assert.ok(relations.length >= 4);

    const terms = relations.map((r) => r.term);
    assert.ok(terms.includes('Iterables'), 'Should connect to Iterables');
    assert.ok(terms.includes('Lambda functions'), 'Should connect to Lambda functions');
    assert.ok(terms.includes('List comprehensions'), 'Should connect to List comprehensions');
    assert.ok(terms.includes('Functional programming'), 'Should connect to Functional programming');

    // Check relationship types
    const iterRel = relations.find((r) => r.term === 'Iterables');
    assert.equal(iterRel.relation, 'prerequisite');
    const compRel = relations.find((r) => r.term === 'List comprehensions');
    assert.equal(compRel.relation, 'alternative');
  });

  it('should return connected concepts for React useMemo', () => {
    const relations = getRelatedConcepts('useMemo');
    assert.ok(relations.length >= 3);
    const terms = relations.map((r) => r.term);
    assert.ok(terms.includes('Referential equality'));
    assert.ok(terms.includes('useCallback'));
    assert.ok(terms.includes('Fiber reconciliation'));
  });

  it('should infer appropriate technical categories', () => {
    assert.equal(inferConceptCategory('useCallback', 'javascript'), 'React');
    assert.equal(inferConceptCategory('def transform_items()', 'python'), 'Python');
    assert.equal(inferConceptCategory('closures and scope', 'javascript'), 'JavaScript');
    assert.equal(inferConceptCategory('CAP Theorem and partitions', ''), 'Architecture');
    assert.equal(inferConceptCategory('Binary search tree traversal', ''), 'Algorithms');
    assert.equal(inferConceptCategory('Content Security Policy nonce', ''), 'Security');
    assert.equal(inferConceptCategory('Shadow DOM custom elements', ''), 'Web Standards');
  });
});

describe('Personal Learning Service & Glossary', () => {
  // In-memory mock storage for Node test environment
  let storageState = {};

  beforeEach(() => {
    storageState = {};
    globalThis.chrome = {
      storage: {
        local: {
          get: async (keys) => {
            const key = Array.isArray(keys) ? keys[0] : keys;
            return { [key]: storageState[key] || [] };
          },
          set: async (items) => {
            Object.assign(storageState, items);
          },
        },
      },
    };
  });

  it('should record concept exploration with initial reviewing level', async () => {
    const context = {
      selectedText: 'Python map()',
      language: 'python',
      pageTitle: 'Python Built-in Functions',
      pageUrl: 'https://docs.python.org/3/library/functions.html#map',
    };
    const explanation = {
      title: 'Python map() Function',
      summary: 'Applies a function to all items in an iterable list.',
      keyPoints: ['Returns a lazy iterator in Python 3.'],
    };

    const concept = await recordConceptExploration(context, explanation);

    assert.ok(concept.id);
    assert.equal(concept.term, 'Python map()');
    assert.equal(concept.category, 'Python');
    assert.equal(concept.understandingLevel, 'reviewing', 'Default should be reviewing (not assumed understood)');
    assert.equal(concept.exploreCount, 1);
    assert.equal(concept.isSaved, false);
    assert.ok(concept.relatedConcepts.length >= 4);
  });

  it('should increment explore count when revisiting existing concept', async () => {
    const context = {
      selectedText: 'useMemo',
      language: 'javascript',
      pageTitle: 'React Reference',
    };
    const explanation = { title: 'useMemo Hook', summary: 'Caches calculation.' };

    const first = await recordConceptExploration(context, explanation);
    assert.equal(first.exploreCount, 1);

    const second = await recordConceptExploration(context, explanation);
    assert.equal(second.exploreCount, 2);
    assert.equal(second.id, first.id, 'Should maintain same concept ID');
  });

  it('should explicitly update understanding level to understood or need_explanation', async () => {
    const context = { selectedText: 'closures', language: 'javascript' };
    const concept = await recordConceptExploration(context, { title: 'Closures' });

    // Mark as understood
    const updated = await updateUnderstandingLevel(concept.id, 'understood');
    assert.equal(updated.understandingLevel, 'understood');

    // Change mind: mark as needing explanation
    const reFlagged = await updateUnderstandingLevel(concept.id, 'need_explanation');
    assert.equal(reFlagged.understandingLevel, 'need_explanation');
  });

  it('should toggle save/bookmark status', async () => {
    const context = { selectedText: 'idempotency' };
    const concept = await recordConceptExploration(context, { title: 'Idempotency' });

    assert.equal(concept.isSaved, false);

    const isNowSaved = await toggleSaveConcept(concept.id);
    assert.equal(isNowSaved, true);

    const isNowUnsaved = await toggleSaveConcept(concept.id);
    assert.equal(isNowUnsaved, false);
  });

  it('should support personal annotations and notes', async () => {
    const context = { selectedText: 'CAP theorem' };
    const concept = await recordConceptExploration(context, { title: 'CAP Theorem' });

    const withNotes = await updateConceptNotes(concept.id, 'Remember PACELC extension for latency.');
    assert.equal(withNotes.notes, 'Remember PACELC extension for latency.');
  });

  it('should filter glossary by search query and category', async () => {
    await recordConceptExploration({ selectedText: 'Python map' }, { summary: 'Iterate over items' });
    await recordConceptExploration({ selectedText: 'useMemo' }, { summary: 'Cache computation' });
    await recordConceptExploration({ selectedText: 'Closure' }, { summary: 'Lexical scope capture' });

    // Free text search
    const resultsMap = await searchGlossary('map');
    assert.equal(resultsMap.length, 1);
    assert.equal(resultsMap[0].term, 'Python map');

    // Category filter
    const reactResults = await searchGlossary('', { category: 'React' });
    assert.equal(reactResults.length, 1);
    assert.equal(reactResults[0].term, 'useMemo');

    // Non-matching query
    const noResults = await searchGlossary('quantum computing');
    assert.equal(noResults.length, 0);
  });

  it('should calculate accurate learning metrics', async () => {
    const c1 = await recordConceptExploration({ selectedText: 'A' }, {});
    const c2 = await recordConceptExploration({ selectedText: 'B' }, {});
    const c3 = await recordConceptExploration({ selectedText: 'C' }, {});

    await updateUnderstandingLevel(c1.id, 'understood');
    await updateUnderstandingLevel(c2.id, 'need_explanation');
    await toggleSaveConcept(c3.id);

    const stats = await getLearningStats();
    assert.equal(stats.totalConcepts, 3);
    assert.equal(stats.understoodCount, 1);
    assert.equal(stats.needExplanationCount, 1);
    assert.equal(stats.savedCount, 1);
    assert.equal(stats.masteryPercentage, 33); // 1 / 3 = 33%
  });

  it('should export formatted JSON and clear data upon request', async () => {
    await recordConceptExploration({ selectedText: 'test_term' }, {});

    const json = await exportLearningData();
    assert.ok(json.includes('Curio Personal Learning Assistant'));
    assert.ok(json.includes('test_term'));

    const cleared = await clearLearningData();
    assert.equal(cleared, true);

    const emptyGlossary = await getGlossary();
    assert.equal(emptyGlossary.length, 0);
  });
});

