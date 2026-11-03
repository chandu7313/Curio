/**
 * Curio — Lightweight Local Concept Graph Storage & Service
 *
 * Persists and manages graph edges connecting concepts locally in chrome.storage.local.
 * Enables users to create, inspect, edit, and delete relationships between concepts.
 *
 * Distinguishes between:
 *  - confirmed: Explicitly verified or created by the user
 *  - isInferred: Inferred automatically by the relationship engine / AI
 *
 * @module shared/services/graphStorage
 */

import { storageAdapter, generateVaultId } from './vaultStorage.js';
import {
  validateRelationship,
  getRelatedConcepts,
  normalizeKey,
  normalizeRelationType,
} from './knowledgeGraph.js';

export const GRAPH_EDGES_KEY = 'curio_graph_edges_v1';

/**
 * Retrieve all custom/user-confirmed graph edges from local storage.
 * @returns {Promise<Array<Object>>}
 */
export async function getGraphEdges() {
  const data = await storageAdapter.get([GRAPH_EDGES_KEY]);
  return data[GRAPH_EDGES_KEY] || [];
}

/**
 * Save or update a relationship edge in the local concept graph.
 *
 * @param {Object} edgeData
 * @param {string} edgeData.sourceTerm
 * @param {string} edgeData.targetTerm
 * @param {'prerequisite'|'related'|'advanced'|'alternative'|'confused_with'} edgeData.relation
 * @param {string} [edgeData.label]
 * @param {boolean} [edgeData.confirmed=false]
 * @param {boolean} [edgeData.isInferred=true]
 * @returns {Promise<Object>} The saved edge
 */
export async function saveGraphEdge(edgeData) {
  const { sourceTerm, targetTerm, relation, label = '', confirmed = false, isInferred = true } = edgeData;

  const validation = validateRelationship(sourceTerm, targetTerm, relation, label);
  if (!validation.valid) {
    throw new Error(`Invalid relationship: ${validation.error}`);
  }

  const edges = await getGraphEdges();
  const normSource = normalizeKey(sourceTerm);
  const normTarget = normalizeKey(targetTerm);
  const canonicalRelation = normalizeRelationType(relation);

  const existingIdx = edges.findIndex(
    (e) => (edgeData.id && e.id === edgeData.id) ||
           (normalizeKey(e.sourceTerm) === normSource &&
            normalizeKey(e.targetTerm) === normTarget &&
            normalizeRelationType(e.relation) === canonicalRelation)
  );

  const now = Date.now();
  let savedEdge;

  if (existingIdx >= 0) {
    savedEdge = {
      ...edges[existingIdx],
      relation: canonicalRelation,
      label: label || edges[existingIdx].label,
      confirmed: confirmed || edges[existingIdx].confirmed,
      isInferred: confirmed ? false : (isInferred ?? edges[existingIdx].isInferred),
      updatedAt: now,
    };
    edges[existingIdx] = savedEdge;
  } else {
    savedEdge = {
      id: edgeData.id || generateVaultId('edge'),
      sourceTerm: sourceTerm.trim(),
      targetTerm: targetTerm.trim(),
      relation: canonicalRelation,
      label: label.trim(),
      confirmed: Boolean(confirmed),
      isInferred: !confirmed,
      createdAt: now,
      updatedAt: now,
    };
    edges.push(savedEdge);
  }

  await storageAdapter.set({ [GRAPH_EDGES_KEY]: edges });
  return savedEdge;
}

/**
 * Update an existing graph edge.
 *
 * @param {string} edgeId
 * @param {Object} updates
 * @returns {Promise<Object|null>}
 */
export async function updateGraphEdge(edgeId, updates) {
  if (!edgeId) return null;
  const edges = await getGraphEdges();
  const idx = edges.findIndex((e) => e.id === edgeId);
  if (idx === -1) return null;

  const existing = edges[idx];
  const relation = updates.relation || existing.relation;
  const sourceTerm = updates.sourceTerm || existing.sourceTerm;
  const targetTerm = updates.targetTerm || existing.targetTerm;

  const validation = validateRelationship(sourceTerm, targetTerm, relation);
  if (!validation.valid) {
    throw new Error(`Invalid relationship update: ${validation.error}`);
  }

  const updated = {
    ...existing,
    ...updates,
    relation: normalizeRelationType(relation),
    updatedAt: Date.now(),
  };

  edges[idx] = updated;
  await storageAdapter.set({ [GRAPH_EDGES_KEY]: edges });
  return updated;
}

/**
 * Delete a graph edge by its ID.
 *
 * @param {string} edgeId
 * @returns {Promise<boolean>}
 */
export async function deleteGraphEdge(edgeId) {
  if (!edgeId) return false;
  const edges = await getGraphEdges();
  const filtered = edges.filter((e) => e.id !== edgeId);
  await storageAdapter.set({ [GRAPH_EDGES_KEY]: filtered });
  return true;
}

/**
 * Build a unified concept graph from concepts and saved edges.
 *
 * @param {Array<Object>} concepts - Array of saved concepts
 * @returns {Promise<{ nodes: Array<Object>, edges: Array<Object> }>}
 */
export async function getUnifiedConceptGraph(concepts = []) {
  const customEdges = await getGraphEdges();
  const nodes = [];
  const edgeList = [...customEdges];

  const nodeMap = new Map();

  for (const c of concepts) {
    const term = c.selectedText || c.term || c.title;
    const norm = normalizeKey(term);
    if (!nodeMap.has(norm)) {
      const nodeObj = {
        id: c.id || generateVaultId('node'),
        term,
        title: c.title || term,
        category: c.category || 'General',
        understandingStatus: c.understandingStatus || c.understandingLevel || 'not_reviewed',
        exploreCount: c.exploreCount || 1,
        isSaved: Boolean(c.isSaved ?? true),
      };
      nodeMap.set(norm, nodeObj);
      nodes.push(nodeObj);
    }
  }

  // Synthesize inferred edges from the knowledge graph for known concepts
  for (const c of concepts) {
    const term = c.selectedText || c.term || c.title;
    const norm = normalizeKey(term);
    const related = getRelatedConcepts(term, c.category);

    for (const rel of related) {
      const normTarget = normalizeKey(rel.term);

      // Check if edge already exists in edgeList
      const alreadyHas = edgeList.some(
        (e) => normalizeKey(e.sourceTerm) === norm &&
               normalizeKey(e.targetTerm) === normTarget
      );

      if (!alreadyHas) {
        edgeList.push({
          id: `inferred_${norm}_${normTarget}`,
          sourceTerm: term,
          targetTerm: rel.term,
          relation: normalizeRelationType(rel.relation),
          label: rel.label || '',
          confirmed: false,
          isInferred: true,
        });

        // If target node isn't in graph yet, add as an unmastered suggestion node
        if (!nodeMap.has(normTarget)) {
          const targetNode = {
            id: `sug_${normTarget}`,
            term: rel.term,
            title: rel.term,
            category: c.category || 'General',
            understandingStatus: 'not_reviewed',
            exploreCount: 0,
            isSaved: false,
            isSuggested: true,
          };
          nodeMap.set(normTarget, targetNode);
          nodes.push(targetNode);
        }
      }
    }
  }

  return { nodes, edges: edgeList };
}

/**
 * Clear all custom graph edges.
 * @returns {Promise<boolean>}
 */
export async function clearGraphEdges() {
  await storageAdapter.remove([GRAPH_EDGES_KEY]);
  return true;
}
