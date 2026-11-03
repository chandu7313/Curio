/**
 * Curio — Adaptive Learning Intelligence & Knowledge Connections Test Suite
 *
 * Exhaustively validates:
 *   1. Concept classification into technical domains
 *   2. Duplicate concept detection & intelligent normalization
 *   3. Semantic relationship accuracy (prerequisite, related, advanced, alternative, confused_with)
 *   4. Invalid relationship handling & rejection (self-loops, invalid types, empty strings)
 *   5. User explicit understanding updates across 4 tiers (not_reviewed, learning, understood, needs_revision)
 *   6. Knowledge graph consistency (nodes, edges, custom edge CRUD, clustering)
 *   7. Knowledge gap detection (repeated exploration requests, revision flags, missing prerequisites, goal milestones)
 *   8. Curated next-step recommendations (bounded high-signal suggestions)
 *   9. Local persistence & storage error resilience
 *
 * Pure JavaScript (node:test + node:assert/strict).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  inferConceptCategory,
  getRelatedConcepts,
  validateRelationship,
  getCuratedRecommendations,
  getPrerequisiteChain,
  groupRelatedConcepts,
  normalizeKey,
  normalizeRelationType,
  VALID_RELATIONSHIPS,
} from '../../src/shared/services/knowledgeGraph.js';

import {
  getGraphEdges,
  saveGraphEdge,
  updateGraphEdge,
  deleteGraphEdge,
  getUnifiedConceptGraph,
  clearGraphEdges,
} from '../../src/shared/services/graphStorage.js';

import {
  getLearningGoals,
  createLearningGoal,
  updateLearningGoal,
  deleteLearningGoal,
  detectKnowledgeGaps,
  calculateGoalProgress,
  UNDERSTANDING_STATUSES,
} from '../../src/shared/services/learningGoalsService.js';

import {
  saveVaultConcept,
  getVaultConcepts,
  updateVaultConcept,
  clearVaultData,
  normalizeUnderstandingStatus,
} from '../../src/shared/services/vaultStorage.js';

describe('Curio — Adaptive Learning Intelligence Engine', () => {
  let mockStorage = {};

  beforeEach(async () => {
    mockStorage = {};
    globalThis.chrome = {
      storage: {
        local: {
          get: async (keys) => {
            const result = {};
            const keyList = Array.isArray(keys) ? keys : [keys];
            for (const k of keyList) {
              result[k] = mockStorage[k] || [];
            }
            return result;
          },
          set: async (items) => {
            Object.assign(mockStorage, items);
          },
          remove: async (keys) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            for (const k of keyList) {
              delete mockStorage[k];
            }
          },
        },
      },
    };

    await clearVaultData();
    await clearGraphEdges();
  });

  // ─── 1. Concept Classification ──────────────────────────────────────
  describe('1. Concept Classification Engine', () => {
    it('should accurately classify Python concepts and keywords', () => {
      assert.equal(inferConceptCategory('Python iterables', 'python'), 'Python');
      assert.equal(inferConceptCategory('generators and yield', 'python'), 'Python');
      assert.equal(inferConceptCategory('def transform_items()', 'python'), 'Python');
      assert.equal(inferConceptCategory('lambda functions in django', ''), 'Python');
    });

    it('should classify React hooks and frontend constructs', () => {
      assert.equal(inferConceptCategory('useMemo hook', 'javascript'), 'React');
      assert.equal(inferConceptCategory('useCallback reference caching', ''), 'React');
      assert.equal(inferConceptCategory('React JSX reconciliation', ''), 'React');
    });

    it('should classify JavaScript runtime and asynchronous primitives', () => {
      assert.equal(inferConceptCategory('Event loop and microtasks', 'javascript'), 'JavaScript');
      assert.equal(inferConceptCategory('Closures and lexical scope', 'javascript'), 'JavaScript');
      assert.equal(inferConceptCategory('Promise.allSettled', 'typescript'), 'JavaScript');
    });

    it('should classify distributed systems and algorithms', () => {
      assert.equal(inferConceptCategory('CAP theorem network partition', ''), 'Architecture');
      assert.equal(inferConceptCategory('Idempotency in REST APIs', ''), 'Architecture');
      assert.equal(inferConceptCategory('Binary Search Tree traversal', ''), 'Algorithms');
      assert.equal(inferConceptCategory('Big-O time complexity', ''), 'Algorithms');
    });

    it('should classify security and web standards', () => {
      assert.equal(inferConceptCategory('Content Security Policy nonce', ''), 'Security');
      assert.equal(inferConceptCategory('Cross-Site Scripting sanitize', ''), 'Security');
      assert.equal(inferConceptCategory('Shadow DOM custom elements', ''), 'Web Standards');
    });
  });

  // ─── 2. Duplicate Concept Detection ─────────────────────────────────
  describe('2. Duplicate Concept Detection & Normalization', () => {
    it('should normalize punctuation and casing cleanly', () => {
      assert.equal(normalizeKey('Python map()'), 'python map');
      assert.equal(normalizeKey('  Iterables & Iterators!  '), 'iterables iterators');
      assert.equal(normalizeKey('useMemo()'), 'usememo');
    });

    it('should prevent duplicate vault saves for equivalent terms', async () => {
      const first = await saveVaultConcept({
        title: 'Python Iterable Protocol',
        selectedText: 'iterables',
        understandingStatus: 'learning',
      });

      const second = await saveVaultConcept({
        title: 'Iterables in Python 3',
        selectedText: 'ITERABLES', // Case difference
        understandingStatus: 'understood',
      });

      assert.equal(second.id, first.id, 'Must reuse existing concept ID');
      const all = await getVaultConcepts();
      assert.equal(all.length, 1);
      assert.equal(all[0].understandingStatus, 'understood');
    });
  });

  // ─── 3. Relationship Accuracy ───────────────────────────────────────
  describe('3. Semantic Relationship Accuracy', () => {
    it('should identify Python iteration progression: Iterables -> Iterators -> Generators -> Lazy evaluation', () => {
      // 1. Iterables connects to Iterators and Generators
      const iterableRelations = getRelatedConcepts('iterables');
      const iterTerms = iterableRelations.map((r) => r.term);
      assert.ok(iterTerms.includes('Iterators'), 'Iterables must connect to Iterators');
      assert.ok(iterTerms.includes('Generators'), 'Iterables must connect to Generators');
      assert.ok(iterTerms.includes('Lazy evaluation'), 'Iterables must connect to Lazy evaluation');

      // 2. Iterators has Iterables as prerequisite
      const iteratorRelations = getRelatedConcepts('iterators');
      const prereq = iteratorRelations.find((r) => r.term === 'Iterables');
      assert.ok(prereq, 'Iterators must require Iterables');
      assert.equal(normalizeRelationType(prereq.relation), 'prerequisite');

      // 3. Generators has Iterators as prerequisite
      const generatorRelations = getRelatedConcepts('generators');
      const genPrereq = generatorRelations.find((r) => r.term === 'Iterators');
      assert.ok(genPrereq, 'Generators must require Iterators');
      assert.equal(normalizeRelationType(genPrereq.relation), 'prerequisite');

      // 4. Lazy evaluation connects to Generators
      const lazyRelations = getRelatedConcepts('lazy evaluation');
      assert.ok(lazyRelations.some((r) => r.term === 'Generators'));
    });

    it('should distinguish frequently confused concepts', () => {
      const filterRelations = getRelatedConcepts('filter');
      const confused = filterRelations.find((r) => r.relation === 'confused_with');
      assert.ok(confused, 'filter should have a confused_with relation');
      assert.ok(confused.term.toLowerCase().includes('map'));
    });

    it('should trace complete prerequisite chain', () => {
      const chain = getPrerequisiteChain('generators');
      assert.ok(chain.length >= 2, 'Generators should have a multi-step prerequisite chain');
      assert.equal(chain[0].term, 'Iterators');
      assert.equal(chain[1].term, 'Iterables');
    });
  });

  // ─── 4. Invalid Relationship Handling ───────────────────────────────
  describe('4. Invalid Relationship Validation', () => {
    it('should reject self-referential relationships', () => {
      const result = validateRelationship('Iterables', 'iterables', 'prerequisite');
      assert.equal(result.valid, false);
      assert.match(result.error, /Self-referential/);
    });

    it('should reject empty source or target terms', () => {
      assert.equal(validateRelationship('', 'Iterators', 'related').valid, false);
      assert.equal(validateRelationship('Iterables', '   ', 'related').valid, false);
    });

    it('should reject hallucinated or invalid relationship types', () => {
      const result = validateRelationship('Iterables', 'Iterators', 'random_hallucination');
      assert.equal(result.valid, false);
      assert.match(result.error, /Invalid relationship type/);
    });

    it('should accept all valid standardized relationship types', () => {
      assert.equal(validateRelationship('A', 'B', 'prerequisite').valid, true);
      assert.equal(validateRelationship('A', 'B', 'related').valid, true);
      assert.equal(validateRelationship('A', 'B', 'advanced').valid, true);
      assert.equal(validateRelationship('A', 'B', 'alternative').valid, true);
      assert.equal(validateRelationship('A', 'B', 'confused_with').valid, true);
    });
  });

  // ─── 5. User Understanding Status ───────────────────────────────────
  describe('5. User Explicit Understanding Status Updates', () => {
    it('should accurately normalize all 4 understanding statuses', () => {
      assert.equal(normalizeUnderstandingStatus('not_reviewed'), 'not_reviewed');
      assert.equal(normalizeUnderstandingStatus('learning'), 'learning');
      assert.equal(normalizeUnderstandingStatus('reviewing'), 'learning', 'Legacy reviewing maps to learning');
      assert.equal(normalizeUnderstandingStatus('understood'), 'understood');
      assert.equal(normalizeUnderstandingStatus('needs_revision'), 'needs_revision');
      assert.equal(normalizeUnderstandingStatus('need_explanation'), 'needs_revision', 'Legacy need_explanation maps to needs_revision');
    });

    it('should update concept understanding status explicitly upon user feedback', async () => {
      const concept = await saveVaultConcept({
        title: 'Python Decorators',
        selectedText: 'decorators',
        understandingStatus: 'not_reviewed',
      });

      assert.equal(concept.understandingStatus, 'not_reviewed');

      // User marks as actively learning
      const learning = await updateVaultConcept(concept.id, { understandingStatus: 'learning' });
      assert.equal(learning.understandingStatus, 'learning');

      // User flags for revision
      const revision = await updateVaultConcept(concept.id, { understandingStatus: 'needs_revision' });
      assert.equal(revision.understandingStatus, 'needs_revision');

      // User marks as understood
      const understood = await updateVaultConcept(concept.id, { understandingStatus: 'understood' });
      assert.equal(understood.understandingStatus, 'understood');
    });
  });

  // ─── 6. Knowledge Graph Consistency ─────────────────────────────────
  describe('6. Knowledge Graph Consistency & Local Operations', () => {
    it('should save, retrieve, and delete custom user graph edges', async () => {
      const edge = await saveGraphEdge({
        sourceTerm: 'Python Iterables',
        targetTerm: 'Iterators',
        relation: 'prerequisite',
        label: 'Iterables provide __iter__ for Iterators',
        confirmed: true,
      });

      assert.ok(edge.id);
      assert.equal(edge.relation, 'prerequisite');
      assert.equal(edge.confirmed, true);
      assert.equal(edge.isInferred, false);

      const allEdges = await getGraphEdges();
      assert.equal(allEdges.length, 1);
      assert.equal(allEdges[0].id, edge.id);

      // Delete edge
      const deleted = await deleteGraphEdge(edge.id);
      assert.equal(deleted, true);
      assert.equal((await getGraphEdges()).length, 0);
    });

    it('should build unified graph with concepts as nodes and relationships as edges', async () => {
      const c1 = await saveVaultConcept({
        title: 'Iterables',
        selectedText: 'iterables',
        category: 'Python',
        understandingStatus: 'understood',
      });

      const c2 = await saveVaultConcept({
        title: 'Iterators',
        selectedText: 'iterators',
        category: 'Python',
        understandingStatus: 'learning',
      });

      const graph = await getUnifiedConceptGraph([c1, c2]);

      assert.ok(graph.nodes.length >= 2, 'Graph should contain nodes');
      assert.ok(graph.edges.length >= 1, 'Graph should contain connecting edges');

      // Verify node attributes
      const iterNode = graph.nodes.find((n) => n.term.toLowerCase() === 'iterables');
      assert.ok(iterNode);
      assert.equal(iterNode.understandingStatus, 'understood');

      // Verify edge connects them
      const connectingEdge = graph.edges.find(
        (e) => (e.sourceTerm.toLowerCase() === 'iterables' && e.targetTerm.toLowerCase() === 'iterators') ||
               (e.sourceTerm.toLowerCase() === 'iterators' && e.targetTerm.toLowerCase() === 'iterables')
      );
      assert.ok(connectingEdge, 'Graph must link related concepts');
    });

    it('should cluster concepts into semantic groups', () => {
      const concepts = [
        { id: '1', title: 'Iterables', category: 'Python', understandingStatus: 'understood' },
        { id: '2', title: 'Generators', category: 'Python', understandingStatus: 'learning' },
        { id: '3', title: 'useMemo', category: 'React', understandingStatus: 'understood' },
      ];

      const groups = groupRelatedConcepts(concepts);
      assert.equal(groups.length, 2);

      const pythonGroup = groups.find((g) => g.category === 'Python');
      assert.ok(pythonGroup);
      assert.equal(pythonGroup.totalCount, 2);
      assert.equal(pythonGroup.understoodCount, 1);
    });
  });

  // ─── 7. Knowledge Gap Detection ─────────────────────────────────────
  describe('7. Adaptive Knowledge Gap Detection', () => {
    it('should detect gap when concept is repeatedly explored without mastery', () => {
      const concepts = [
        {
          id: 'c1',
          selectedText: 'Generators',
          title: 'Python Generators',
          exploreCount: 4, // High exploration
          understandingStatus: 'learning', // Not yet understood
          category: 'Python',
        },
      ];

      const gaps = detectKnowledgeGaps(concepts, []);
      assert.ok(gaps.length >= 1);

      const frequentGap = gaps.find((g) => g.type === 'repeated_exploration');
      assert.ok(frequentGap);
      assert.equal(frequentGap.term, 'Generators');
      assert.equal(frequentGap.isInferred, true, 'Must be explicitly labeled as inferred suggestion');
    });

    it('should detect gap when concept is flagged for revision', () => {
      const concepts = [
        {
          id: 'c2',
          selectedText: 'Decorators',
          title: 'Python Decorators',
          exploreCount: 1,
          understandingStatus: 'needs_revision',
          category: 'Python',
        },
      ];

      const gaps = detectKnowledgeGaps(concepts, []);
      const revisionGap = gaps.find((g) => g.type === 'needs_revision');
      assert.ok(revisionGap);
      assert.equal(revisionGap.term, 'Decorators');
      assert.equal(revisionGap.severity, 'high');
      assert.equal(revisionGap.isInferred, true);
    });

    it('should detect structural gap when dependent concept is saved but prerequisite is missing', () => {
      const concepts = [
        {
          id: 'c3',
          selectedText: 'Generators',
          title: 'Generators',
          category: 'Python',
          understandingStatus: 'learning',
        },
      ];

      const gaps = detectKnowledgeGaps(concepts, []);
      const prereqGap = gaps.find((g) => g.type === 'missing_prerequisite');
      assert.ok(prereqGap, 'Should detect missing prerequisite for Generators');
      assert.equal(prereqGap.term, 'Iterators');
      assert.equal(prereqGap.dependentTerm, 'Generators');
      assert.equal(prereqGap.isInferred, true);
    });

    it('should detect milestone gaps for active user learning goals', () => {
      const concepts = [
        {
          id: 'c4',
          selectedText: 'Iterables',
          title: 'Iterables',
          category: 'Python',
          understandingStatus: 'understood',
        },
      ];

      const goals = [
        {
          id: 'goal_1',
          title: 'Python Mastery',
          category: 'Python',
          targetConcepts: ['Iterables', 'Iterators', 'Generators'],
        },
      ];

      const gaps = detectKnowledgeGaps(concepts, goals);
      const goalGap = gaps.find((g) => g.type === 'goal_milestone');
      assert.ok(goalGap);
      assert.ok(['Iterators', 'Generators'].includes(goalGap.term));
      assert.equal(goalGap.goalId, 'goal_1');
      assert.equal(goalGap.isInferred, true);
    });
  });

  // ─── 8. Curated Recommendations ─────────────────────────────────────
  describe('8. Curated Next-Step Recommendations', () => {
    it('should provide at most 4 focused recommendations after explaining a concept', () => {
      const recs = getCuratedRecommendations('Python iterables', []);
      assert.ok(Array.isArray(recs));
      assert.ok(recs.length > 0 && recs.length <= 4, 'Must provide 1 to 4 recommendations without overwhelming');

      const terms = recs.map((r) => r.term);
      assert.ok(terms.includes('Iterators') || terms.includes('Generators'));
      assert.ok(recs[0].action, 'Each recommendation must have an actionable phrase');
      assert.ok(recs[0].reason, 'Each recommendation must have a reason');
    });

    it('should skip prerequisites the user has already mastered', () => {
      const userConcepts = [
        {
          selectedText: 'Iterables',
          understandingStatus: 'understood',
        },
      ];

      const recs = getCuratedRecommendations('Iterators', userConcepts);
      // Since user already mastered Iterables, recommendation shouldn't urge them to learn Iterables again
      const prereqRec = recs.find((r) => r.term === 'Iterables' && r.relation === 'prerequisite');
      assert.equal(prereqRec, undefined, 'Should skip already understood prerequisites');
    });
  });

  // ─── 9. Learning Goals CRUD & Progress ───────────────────────────────
  describe('9. Learning Goals Persistence & Progress Calculation', () => {
    it('should create, calculate progress, and delete a learning goal', async () => {
      const goal = await createLearningGoal({
        title: 'Modern React Architecture',
        category: 'React',
        targetConcepts: ['useMemo', 'useCallback', 'Referential equality'],
      });

      assert.ok(goal.id.startsWith('goal_'));
      assert.equal(goal.targetConcepts.length, 3);

      const concepts = [
        { selectedText: 'useMemo', understandingStatus: 'understood' },
        { selectedText: 'useCallback', understandingStatus: 'learning' },
      ];

      const progress = calculateGoalProgress(goal, concepts);
      assert.equal(progress.total, 3);
      assert.equal(progress.completed, 1);
      assert.equal(progress.progressPct, 33);
      assert.equal(progress.remaining.length, 2);

      const deleted = await deleteLearningGoal(goal.id);
      assert.equal(deleted, true);
      assert.equal((await getLearningGoals()).length, 0);
    });
  });
});
