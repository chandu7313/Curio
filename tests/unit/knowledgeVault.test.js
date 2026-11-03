/**
 * Curio — Personal Knowledge Vault Comprehensive Test Suite
 *
 * Exhaustively validates:
 *   1. Save and retrieve (full data model, auto code block extraction, tag derivation)
 *   2. Duplicate concept handling (case-insensitive deduplication, ID preservation)
 *   3. Multi-attribute local search (title, term, explanation, notes, code, tags)
 *   4. Filter and sort (category, tag, collection, understanding status, multiple sort orders)
 *   5. Collection management (CRUD, assignment, safe deletion with concept unlinking)
 *   6. Concept editing & partial updates (notes, tags, understanding status)
 *   7. Deletion & erasure
 *   8. Complete JSON export and import (schema validation, deduplication, stats)
 *   9. Storage quota handling & error resilience (chrome.storage error fallback)
 *  10. Extension restart persistence simulation
 *
 * Pure JavaScript (Node.js test runner: node:test + node:assert/strict).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  VAULT_CONCEPTS_KEY,
  VAULT_COLLECTIONS_KEY,
  storageAdapter,
  generateVaultId,
  extractCodeBlocks,
  getVaultConcepts,
  getConceptById,
  saveVaultConcept,
  updateVaultConcept,
  deleteVaultConcept,
  getVaultCollections,
  createVaultCollection,
  updateVaultCollection,
  deleteVaultCollection,
  searchVaultConcepts,
  exportVaultData,
  importVaultData,
  clearVaultData,
} from '../../src/shared/services/vaultStorage.js';

describe('Curio Knowledge Vault — Core Data Operations', () => {
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
  });

  describe('1. Save and Retrieve Concepts', () => {
    it('should save a new concept and retrieve it with the required schema', async () => {
      const conceptData = {
        title: 'Python Iterable',
        selectedText: 'iterable',
        explanation: 'An iterable is any Python object capable of returning its members one at a time.',
        codeExamples: [
          { language: 'python', code: 'for item in [1, 2, 3]:\n    print(item)' }
        ],
        tags: ['Python', 'Programming'],
        category: 'Python',
        collectionId: null,
        userNotes: 'Fundamental to understand for loops and generators.',
        understandingStatus: 'not_reviewed',
        pageTitle: 'Python Data Model Documentation',
        pageUrl: 'https://docs.python.org/3/reference/datamodel.html',
      };

      const saved = await saveVaultConcept(conceptData);

      assert.ok(saved.id, 'Concept must have an id');
      assert.equal(saved.title, 'Python Iterable');
      assert.equal(saved.selectedText, 'iterable');
      assert.equal(saved.category, 'Python');
      assert.equal(saved.understandingStatus, 'not_reviewed');
      assert.equal(saved.userNotes, 'Fundamental to understand for loops and generators.');
      assert.equal(saved.codeExamples.length, 1);
      assert.equal(saved.tags.includes('Python'), true);
      assert.equal(saved.tags.includes('Programming'), true);
      assert.ok(saved.createdAt > 0);
      assert.ok(saved.updatedAt > 0);

      // Verify retrieval by ID
      const retrieved = await getConceptById(saved.id);
      assert.ok(retrieved);
      assert.equal(retrieved.id, saved.id);
      assert.equal(retrieved.title, 'Python Iterable');

      // Verify retrieval in list
      const all = await getVaultConcepts();
      assert.equal(all.length, 1);
      assert.equal(all[0].id, saved.id);
    });

    it('should automatically extract code blocks from Markdown explanation if codeExamples not provided', async () => {
      const markdown = `
Here is how you use map in Python:
\`\`\`python
numbers = [1, 2, 3, 4]
squared = list(map(lambda x: x**2, numbers))
\`\`\`
And in JavaScript:
\`\`\`javascript
const squared = [1, 2, 3, 4].map(x => x ** 2);
\`\`\`
`;
      const saved = await saveVaultConcept({
        selectedText: 'map function',
        explanation: markdown,
        category: 'General',
      });

      assert.ok(saved.codeExamples);
      assert.equal(saved.codeExamples.length, 2);
      assert.equal(saved.codeExamples[0].language, 'python');
      assert.ok(saved.codeExamples[0].code.includes('numbers = [1, 2, 3, 4]'));
      assert.equal(saved.codeExamples[1].language, 'javascript');
      assert.ok(saved.codeExamples[1].code.includes('.map(x => x ** 2)'));
    });

    it('should auto-derive category tag and language tag when provided', async () => {
      const saved = await saveVaultConcept({
        selectedText: 'useMemo',
        category: 'React',
        language: 'typescript',
        tags: ['Hooks'],
      });

      assert.ok(saved.tags.includes('React'));
      assert.ok(saved.tags.includes('typescript'));
      assert.ok(saved.tags.includes('Hooks'));
    });
  });

  describe('2. Duplicate Concept Handling', () => {
    it('should update existing concept when saving with the same selected text (case-insensitive)', async () => {
      const first = await saveVaultConcept({
        title: 'Python Lambda Functions',
        selectedText: 'lambda functions',
        explanation: 'Anonymous small functions.',
        userNotes: 'First note',
        understandingStatus: 'not_reviewed',
      });

      // User saves again from another page or re-explains
      const second = await saveVaultConcept({
        selectedText: 'LAMBDA FUNCTIONS', // Case difference
        explanation: 'Updated anonymous function explanation with closure context.',
        userNotes: 'Updated comprehensive note',
        understandingStatus: 'need_explanation',
      });

      const all = await getVaultConcepts();
      assert.equal(all.length, 1, 'Should NOT create duplicate concept');
      assert.equal(second.id, first.id, 'Must preserve existing concept ID');
      assert.equal(second.userNotes, 'Updated comprehensive note');
      assert.equal(second.understandingStatus, 'need_explanation');
      assert.ok(second.updatedAt >= first.updatedAt);
    });

    it('should update existing concept when explicitly passing matching id', async () => {
      const first = await saveVaultConcept({
        title: 'Original Title',
        selectedText: 'currying',
        userNotes: 'Note 1',
      });

      const second = await saveVaultConcept({
        id: first.id,
        title: 'Revised Title: Functional Currying',
        selectedText: 'currying in JS',
        userNotes: 'Note 2',
      });

      const all = await getVaultConcepts();
      assert.equal(all.length, 1);
      assert.equal(second.id, first.id);
      assert.equal(second.title, 'Revised Title: Functional Currying');
      assert.equal(second.userNotes, 'Note 2');
    });
  });

  describe('3. Multi-Attribute Local Search', () => {
    beforeEach(async () => {
      await saveVaultConcept({
        title: 'Python Iterables',
        selectedText: 'iterables',
        explanation: 'Objects capable of returning members one by one. Supports __iter__ protocol.',
        codeExamples: [{ language: 'python', code: 'for x in iter(obj): pass', caption: 'Iteration' }],
        tags: ['Python', 'Data Structures'],
        category: 'Python',
        userNotes: 'Important for understanding generators and list comprehensions.',
        understandingStatus: 'understood',
      });

      await saveVaultConcept({
        title: 'Lambda Functions',
        selectedText: 'lambda',
        explanation: 'Inline anonymous functions defined with the lambda keyword.',
        codeExamples: [{ language: 'python', code: 'square = lambda x: x * x', caption: 'Anonymous function' }],
        tags: ['Python', 'Functional'],
        category: 'Python',
        userNotes: 'Commonly paired with map and filter functions.',
        understandingStatus: 'not_reviewed',
      });

      await saveVaultConcept({
        title: 'React useMemo Hook',
        selectedText: 'useMemo',
        explanation: 'Caches the result of a calculation between re-renders.',
        codeExamples: [{ language: 'javascript', code: 'const val = useMemo(() => compute(), [dep]);', caption: 'Memoization' }],
        tags: ['React', 'Performance', 'Hooks'],
        category: 'React',
        userNotes: 'Avoid premature optimization; measure first.',
        understandingStatus: 'need_explanation',
      });
    });

    it('should search by title', async () => {
      const results = await searchVaultConcepts({ query: 'Iterables' });
      assert.equal(results.length, 1);
      assert.equal(results[0].title, 'Python Iterables');
    });

    it('should search by selected terminology', async () => {
      const results = await searchVaultConcepts({ query: 'lambda' });
      assert.equal(results.length, 1);
      assert.equal(results[0].selectedText, 'lambda');
    });

    it('should search within explanation text', async () => {
      const results = await searchVaultConcepts({ query: '__iter__' });
      assert.equal(results.length, 1);
      assert.equal(results[0].title, 'Python Iterables');
    });

    it('should search within user notes', async () => {
      const results = await searchVaultConcepts({ query: 'premature optimization' });
      assert.equal(results.length, 1);
      assert.equal(results[0].title, 'React useMemo Hook');
    });

    it('should search within code examples', async () => {
      const results = await searchVaultConcepts({ query: 'compute()' });
      assert.equal(results.length, 1);
      assert.equal(results[0].title, 'React useMemo Hook');
    });

    it('should search within tags', async () => {
      const results = await searchVaultConcepts({ query: 'Functional' });
      assert.equal(results.length, 1);
      assert.equal(results[0].title, 'Lambda Functions');
    });

    it('should filter by category', async () => {
      const results = await searchVaultConcepts({ category: 'Python' });
      assert.equal(results.length, 2);
    });

    it('should filter by tag', async () => {
      const results = await searchVaultConcepts({ tag: 'Performance' });
      assert.equal(results.length, 1);
      assert.equal(results[0].title, 'React useMemo Hook');
    });

    it('should filter by understanding status', async () => {
      const understood = await searchVaultConcepts({ understandingStatus: 'understood' });
      assert.equal(understood.length, 1);
      assert.equal(understood[0].title, 'Python Iterables');

      const reviewNeeded = await searchVaultConcepts({ understandingStatus: 'need_explanation' });
      assert.equal(reviewNeeded.length, 1);
      assert.equal(reviewNeeded[0].title, 'React useMemo Hook');
    });

    it('should sort concepts by title ascending and descending', async () => {
      const asc = await searchVaultConcepts({ sortBy: 'title_asc' });
      assert.equal(asc[0].title, 'Lambda Functions');
      assert.equal(asc[2].title, 'React useMemo Hook');

      const desc = await searchVaultConcepts({ sortBy: 'title_desc' });
      assert.equal(desc[0].title, 'React useMemo Hook');
      assert.equal(desc[2].title, 'Lambda Functions');
    });

    it('should sort concepts by understanding status urgency', async () => {
      const sorted = await searchVaultConcepts({ sortBy: 'understanding' });
      // need_explanation (0), not_reviewed (1), understood (2)
      assert.equal(sorted[0].understandingStatus, 'need_explanation');
      assert.equal(sorted[1].understandingStatus, 'not_reviewed');
      assert.equal(sorted[2].understandingStatus, 'understood');
    });
  });

  describe('4. Collection Management', () => {
    it('should create and retrieve custom collections', async () => {
      const col = await createVaultCollection({
        name: 'Python Mastery',
        description: 'Advanced Python internals and memory model',
        color: '#8b5cf6',
      });

      assert.ok(col.id.startsWith('col_'));
      assert.equal(col.name, 'Python Mastery');
      assert.equal(col.color, '#8b5cf6');

      const all = await getVaultCollections();
      assert.equal(all.length, 1);
      assert.equal(all[0].id, col.id);
    });

    it('should update collection properties', async () => {
      const col = await createVaultCollection({ name: 'Web Dev' });
      const updated = await updateVaultCollection(col.id, {
        name: 'Modern Web Architecture',
        color: '#0d9488',
      });

      assert.equal(updated.name, 'Modern Web Architecture');
      assert.equal(updated.color, '#0d9488');
    });

    it('should assign concepts to collections and filter by collection', async () => {
      const col1 = await createVaultCollection({ name: 'Frontend' });
      const col2 = await createVaultCollection({ name: 'Backend' });

      await saveVaultConcept({
        title: 'Virtual DOM',
        selectedText: 'vdom',
        collectionId: col1.id,
      });

      await saveVaultConcept({
        title: 'PostgreSQL Indexes',
        selectedText: 'btree',
        collectionId: col2.id,
      });

      const frontendConcepts = await searchVaultConcepts({ collectionId: col1.id });
      assert.equal(frontendConcepts.length, 1);
      assert.equal(frontendConcepts[0].title, 'Virtual DOM');

      const backendConcepts = await searchVaultConcepts({ collectionId: col2.id });
      assert.equal(backendConcepts.length, 1);
      assert.equal(backendConcepts[0].title, 'PostgreSQL Indexes');
    });

    it('should safely delete collection and unlink concepts without deleting the concepts', async () => {
      const col = await createVaultCollection({ name: 'Temporary Collection' });
      const concept = await saveVaultConcept({
        title: 'Linked Concept',
        selectedText: 'linked',
        collectionId: col.id,
      });

      // Delete the collection
      const deleteResult = await deleteVaultCollection(col.id);
      assert.equal(deleteResult, true);

      // Collection is gone
      const collections = await getVaultCollections();
      assert.equal(collections.length, 0);

      // Concept is still present, with collectionId set to null
      const updatedConcept = await getConceptById(concept.id);
      assert.ok(updatedConcept);
      assert.equal(updatedConcept.collectionId, null);
    });
  });

  describe('5. Editing & Partial Updates', () => {
    it('should partially update user notes, tags, and understanding status', async () => {
      const concept = await saveVaultConcept({
        title: 'Decorators in Python',
        selectedText: 'decorators',
        userNotes: 'Draft note',
        tags: ['Python'],
        understandingStatus: 'not_reviewed',
      });

      const updated = await updateVaultConcept(concept.id, {
        userNotes: 'Decorators are functions taking another function and returning an extended wrapper.',
        tags: ['Python', 'Metaprogramming', 'Advanced'],
        understandingStatus: 'understood',
      });

      assert.equal(updated.id, concept.id);
      assert.equal(updated.userNotes.includes('extended wrapper'), true);
      assert.equal(updated.tags.length, 3);
      assert.equal(updated.understandingStatus, 'understood');
      assert.ok(updated.updatedAt >= concept.createdAt);

      const fetched = await getConceptById(concept.id);
      assert.equal(fetched.understandingStatus, 'understood');
      assert.equal(fetched.tags.includes('Metaprogramming'), true);
    });
  });

  describe('6. Concept Deletion', () => {
    it('should delete a concept by ID and remove it from search and storage', async () => {
      const c1 = await saveVaultConcept({ title: 'Concept 1', selectedText: 'text 1' });
      const c2 = await saveVaultConcept({ title: 'Concept 2', selectedText: 'text 2' });

      assert.equal((await getVaultConcepts()).length, 2);

      const deleted = await deleteVaultConcept(c1.id);
      assert.equal(deleted, true);

      const all = await getVaultConcepts();
      assert.equal(all.length, 1);
      assert.equal(all[0].id, c2.id);

      const fetched = await getConceptById(c1.id);
      assert.equal(fetched, null);
    });
  });

  describe('7. Export & Import Operations', () => {
    it('should export complete vault data as a valid JSON string with metadata', async () => {
      const col = await createVaultCollection({ name: 'CS Core' });
      await saveVaultConcept({
        title: 'Binary Heap',
        selectedText: 'binary heap',
        collectionId: col.id,
        tags: ['Algorithms'],
      });

      const jsonStr = await exportVaultData();
      assert.equal(typeof jsonStr, 'string');

      const parsed = JSON.parse(jsonStr);
      assert.equal(parsed.app, 'Curio Personal Knowledge Vault');
      assert.equal(parsed.version, '1.0.0');
      assert.ok(parsed.exportedAt);
      assert.equal(parsed.stats.totalConcepts, 1);
      assert.equal(parsed.stats.totalCollections, 1);
      assert.equal(parsed.collections.length, 1);
      assert.equal(parsed.concepts.length, 1);
      assert.equal(parsed.concepts[0].title, 'Binary Heap');
    });

    it('should import previously exported knowledge and merge with deduplication', async () => {
      // Seed existing item
      await saveVaultConcept({
        title: 'Original Title',
        selectedText: 'Recursion',
        userNotes: 'Old notes',
      });

      const importPayload = {
        app: 'Curio Personal Knowledge Vault',
        collections: [
          { id: 'col_algorithms', name: 'Algorithms & Structures', color: '#10b981' }
        ],
        concepts: [
          {
            selectedText: 'Recursion', // Same selectedText -> should update existing
            title: 'Recursion in Functional Programming',
            userNotes: 'Updated base-case rule',
            understandingStatus: 'understood',
          },
          {
            selectedText: 'Memoization', // New -> should import
            title: 'Memoization Optimization',
            userNotes: 'Caching expensive calls',
            understandingStatus: 'not_reviewed',
          }
        ]
      };

      const result = await importVaultData(JSON.stringify(importPayload));

      assert.equal(result.importedCollections, 1);
      assert.equal(result.importedConcepts, 1, '1 new concept imported');
      assert.equal(result.updatedConcepts, 1, '1 existing concept updated');

      const all = await getVaultConcepts();
      assert.equal(all.length, 2);

      const recursion = all.find((c) => c.selectedText.toLowerCase() === 'recursion');
      assert.equal(recursion.title, 'Recursion in Functional Programming');
      assert.equal(recursion.userNotes, 'Updated base-case rule');
      assert.equal(recursion.understandingStatus, 'understood');

      const memo = all.find((c) => c.selectedText.toLowerCase() === 'memoization');
      assert.ok(memo);
      assert.equal(memo.title, 'Memoization Optimization');
    });

    it('should reject invalid JSON strings or malformed payloads', async () => {
      await assert.rejects(
        () => importVaultData('NOT VALID JSON'),
        /Invalid JSON format/
      );

      await assert.rejects(
        () => importVaultData(JSON.stringify({ concepts: 'not-an-array' })),
        /concepts must be an array/
      );
    });
  });

  describe('8. Storage Quota Handling & Error Resilience', () => {
    it('should gracefully handle chrome.storage quota or runtime errors without crashing', async () => {
      // Simulate quota error in chrome.storage.local.set
      globalThis.chrome.storage.local.set = async () => {
        throw new Error('QUOTA_BYTES_PER_ITEM quota exceeded: 8192 bytes limit');
      };

      // saveVaultConcept should catch or handle fallback cleanly
      const saved = await saveVaultConcept({
        title: 'Large Concept Entry',
        selectedText: 'quota test',
        explanation: 'Very large payload content testing quota resilience.',
      });

      assert.ok(saved);
      assert.equal(saved.title, 'Large Concept Entry');
    });

    it('should completely clear vault concepts and collections when requested', async () => {
      await createVaultCollection({ name: 'To be wiped' });
      await saveVaultConcept({ title: 'Wipe me', selectedText: 'wipe' });

      assert.equal((await getVaultConcepts()).length, 1);
      assert.equal((await getVaultCollections()).length, 1);

      await clearVaultData();

      assert.equal((await getVaultConcepts()).length, 0);
      assert.equal((await getVaultCollections()).length, 0);
    });
  });

  describe('9. Extension Restart Persistence Simulation', () => {
    it('should persist concepts across extension restart simulation', async () => {
      // Step 1: User saves concepts in active extension session
      await saveVaultConcept({
        title: 'Generators in Python',
        selectedText: 'generators',
        explanation: 'Functions utilizing the yield keyword to produce a generator iterator.',
        tags: ['Python', 'Generators'],
      });

      // Step 2: Extension process terminates and restarts (reloads from chrome.storage.local)
      // StorageAdapter calls chrome.storage.local.get to reconstruct state
      const reloadedConcepts = await getVaultConcepts();

      assert.equal(reloadedConcepts.length, 1);
      assert.equal(reloadedConcepts[0].title, 'Generators in Python');
      assert.equal(reloadedConcepts[0].selectedText, 'generators');
    });
  });
});
