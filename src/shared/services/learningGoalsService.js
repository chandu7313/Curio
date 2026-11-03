/**
 * Curio — Adaptive Learning Goals & Knowledge Gap Detection Service
 *
 * Implements:
 *  - User learning goal tracking and milestone evaluation
 *  - Intelligent knowledge gap detection based on:
 *      1. Repeated explanation requests (high exploration frequency without mastery)
 *      2. User explicit feedback (concepts flagged with 'needs_revision')
 *      3. Structural graph gaps (missing or unlearned prerequisite concepts)
 *      4. Learning goal targets and prerequisites
 *  - Strict privacy and control: All inferred gaps are explicitly labelled as
 *    suggestions, never confirmed weaknesses.
 *
 * @module shared/services/learningGoalsService
 */

import { storageAdapter, generateVaultId } from './vaultStorage.js';
import {
  getRelatedConcepts,
  getPrerequisiteChain,
  normalizeKey,
  normalizeRelationType,
} from './knowledgeGraph.js';

export const LEARNING_GOALS_KEY = 'curio_learning_goals_v1';

/**
 * Standard learning understanding statuses.
 */
export const UNDERSTANDING_STATUSES = {
  NOT_REVIEWED: 'not_reviewed',
  LEARNING: 'learning',
  UNDERSTOOD: 'understood',
  NEEDS_REVISION: 'needs_revision',
};

/**
 * Default curated learning goals for quick adoption.
 */
export const PRESET_LEARNING_GOALS = [
  {
    title: 'Python Iteration & Functional Mastery',
    category: 'Python',
    description: 'Master iterables, stateful iterators, generator expressions, lazy evaluation, and decorators.',
    targetConcepts: ['Iterables', 'Iterators', 'Generators', 'Lazy evaluation', 'Lambda functions', 'Python map', 'Decorators'],
  },
  {
    title: 'Modern React Performance & Architecture',
    category: 'React',
    description: 'Understand referential equality, component memoization, and reconciliation internals.',
    targetConcepts: ['useMemo', 'useCallback', 'Referential equality', 'React.memo', 'Fiber reconciliation'],
  },
  {
    title: 'Asynchronous JavaScript & Event Loop',
    category: 'JavaScript',
    description: 'Deep dive into V8 runtime execution, macro/microtask queues, Promises, and async patterns.',
    targetConcepts: ['Event loop', 'Promises', 'Microtask queue', 'async await', 'Closures'],
  },
  {
    title: 'Distributed Systems & Resilience',
    category: 'Architecture',
    description: 'Learn core consistency models, consensus principles, network partition tolerance, and safe retries.',
    targetConcepts: ['CAP theorem', 'Idempotency', 'Distributed consensus', 'Eventual consistency', 'Partition tolerance'],
  },
];

/**
 * Retrieve all user-selected learning goals.
 * @returns {Promise<Array<Object>>}
 */
export async function getLearningGoals() {
  const data = await storageAdapter.get([LEARNING_GOALS_KEY]);
  return data[LEARNING_GOALS_KEY] || [];
}

/**
 * Create a new learning goal.
 *
 * @param {Object} goalData
 * @param {string} goalData.title
 * @param {string} [goalData.description]
 * @param {string} [goalData.category='General']
 * @param {Array<string>} [goalData.targetConcepts=[]]
 * @returns {Promise<Object>}
 */
export async function createLearningGoal(goalData) {
  const goals = await getLearningGoals();
  const now = Date.now();

  const newGoal = {
    id: goalData.id || generateVaultId('goal'),
    title: (goalData.title || 'Untitled Learning Goal').trim(),
    description: (goalData.description || '').trim(),
    category: goalData.category || 'General',
    targetConcepts: Array.isArray(goalData.targetConcepts) ? goalData.targetConcepts : [],
    createdAt: now,
    updatedAt: now,
  };

  goals.push(newGoal);
  await storageAdapter.set({ [LEARNING_GOALS_KEY]: goals });
  return newGoal;
}

/**
 * Update an existing learning goal.
 *
 * @param {string} goalId
 * @param {Object} updates
 * @returns {Promise<Object|null>}
 */
export async function updateLearningGoal(goalId, updates) {
  if (!goalId) return null;
  const goals = await getLearningGoals();
  const idx = goals.findIndex((g) => g.id === goalId);
  if (idx === -1) return null;

  const updated = {
    ...goals[idx],
    ...updates,
    updatedAt: Date.now(),
  };

  goals[idx] = updated;
  await storageAdapter.set({ [LEARNING_GOALS_KEY]: goals });
  return updated;
}

/**
 * Delete a learning goal.
 *
 * @param {string} goalId
 * @returns {Promise<boolean>}
 */
export async function deleteLearningGoal(goalId) {
  if (!goalId) return false;
  const goals = await getLearningGoals();
  const filtered = goals.filter((g) => g.id !== goalId);
  await storageAdapter.set({ [LEARNING_GOALS_KEY]: filtered });
  return true;
}

/**
 * Calculate progress metrics for a given learning goal against saved concepts.
 *
 * @param {Object} goal
 * @param {Array<Object>} concepts
 * @returns {Object}
 */
export function calculateGoalProgress(goal, concepts = []) {
  if (!goal || !goal.targetConcepts || goal.targetConcepts.length === 0) {
    return { progressPct: 0, total: 0, completed: 0, remaining: [] };
  }

  const normalizedConceptMap = new Map();
  for (const c of concepts) {
    const term = c.selectedText || c.term || c.title || '';
    const status = c.understandingStatus || c.understandingLevel || 'not_reviewed';
    normalizedConceptMap.set(normalizeKey(term), status);
  }

  let completed = 0;
  const remaining = [];

  for (const target of goal.targetConcepts) {
    const norm = normalizeKey(target);
    const status = normalizedConceptMap.get(norm);
    if (status === 'understood') {
      completed++;
    } else {
      remaining.push({
        term: target,
        status: status || 'unexplored',
      });
    }
  }

  const total = goal.targetConcepts.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    progressPct,
    total,
    completed,
    remaining,
  };
}

/**
 * Comprehensive Knowledge Gap Detection Engine.
 *
 * Identifies potential gaps based on:
 *   1. Repeated exploration requests (exploreCount >= 3 without mastery)
 *   2. Explicit user feedback (concepts marked 'needs_revision' or 'need_explanation')
 *   3. Structural graph gaps (unexplored or unmastered prerequisites for saved concepts)
 *   4. Goal milestones remaining
 *
 * All gaps are explicitly marked as inferred suggestions with actionable explanations.
 *
 * @param {Array<Object>} concepts - User's concepts from vault or glossary
 * @param {Array<Object>} [goals=[]] - Active user learning goals
 * @returns {Array<Object>} Inferred knowledge gap suggestions
 */
export function detectKnowledgeGaps(concepts = [], goals = []) {
  const gaps = [];
  const seenGaps = new Set();

  const conceptStatusMap = new Map();
  for (const c of concepts) {
    const term = c.selectedText || c.term || c.title || '';
    const norm = normalizeKey(term);
    const status = c.understandingStatus || c.understandingLevel || 'not_reviewed';
    conceptStatusMap.set(norm, {
      term,
      status,
      exploreCount: c.exploreCount || 1,
      category: c.category || 'General',
      id: c.id,
    });
  }

  // 1. Repeated Exploration Requests (exploreCount >= 3 and not understood)
  for (const c of concepts) {
    const term = c.selectedText || c.term || c.title || '';
    const count = c.exploreCount || 1;
    const status = c.understandingStatus || c.understandingLevel || 'not_reviewed';

    if (count >= 3 && status !== 'understood') {
      const gapKey = `frequent_${normalizeKey(term)}`;
      if (!seenGaps.has(gapKey)) {
        seenGaps.add(gapKey);
        gaps.push({
          id: gapKey,
          type: 'repeated_exploration',
          term,
          category: c.category || 'General',
          title: `Frequently revisited: ${term}`,
          description: `You have requested explanations for ${term} ${count} times without marking it as understood. Consider reviewing foundational analogies or asking for concrete edge cases.`,
          severity: 'medium',
          isInferred: true,
          action: `Review ${term} Fundamentals`,
          conceptId: c.id,
        });
      }
    }
  }

  // 2. Explicit User Feedback: Marked 'needs_revision' or 'need_explanation'
  for (const c of concepts) {
    const term = c.selectedText || c.term || c.title || '';
    const status = c.understandingStatus || c.understandingLevel || 'not_reviewed';

    if (status === 'needs_revision' || status === 'need_explanation') {
      const gapKey = `revision_${normalizeKey(term)}`;
      if (!seenGaps.has(gapKey)) {
        seenGaps.add(gapKey);
        gaps.push({
          id: gapKey,
          type: 'needs_revision',
          term,
          category: c.category || 'General',
          title: `Flagged for revision: ${term}`,
          description: `You explicitly flagged ${term} as needing review. Re-reading code samples and testing your understanding will solidify mastery.`,
          severity: 'high',
          isInferred: true,
          action: `Practice & Revise ${term}`,
          conceptId: c.id,
        });
      }
    }
  }

  // 3. Structural Graph Gaps: Missing or unmastered prerequisites
  for (const c of concepts) {
    const term = c.selectedText || c.term || c.title || '';
    const norm = normalizeKey(term);
    const related = getRelatedConcepts(term, c.category);

    for (const rel of related) {
      if (normalizeRelationType(rel.relation) === 'prerequisite') {
        const normPrereq = normalizeKey(rel.term);
        const prereqRecord = conceptStatusMap.get(normPrereq);

        const isMissing = !prereqRecord;
        const isUnmastered = prereqRecord && prereqRecord.status !== 'understood';

        if (isMissing || isUnmastered) {
          const gapKey = `prereq_${normPrereq}_for_${norm}`;
          if (!seenGaps.has(gapKey)) {
            seenGaps.add(gapKey);
            gaps.push({
              id: gapKey,
              type: 'missing_prerequisite',
              term: rel.term,
              dependentTerm: term,
              category: c.category || 'General',
              title: `Prerequisite Gap: ${rel.term} (needed for ${term})`,
              description: isMissing
                ? `You saved "${term}", but haven't explored its prerequisite "${rel.term}" yet. Understanding "${rel.term}" will make "${term}" much easier to grasp.`
                : `You explored "${term}", but its prerequisite "${rel.term}" is still marked as ${prereqRecord.status.replace('_', ' ')}.`,
              severity: isMissing ? 'medium' : 'low',
              isInferred: true,
              action: `Learn Prerequisite: ${rel.term}`,
            });
          }
        }
      }
    }
  }

  // 4. Learning Goal Milestones
  for (const goal of goals) {
    const progress = calculateGoalProgress(goal, concepts);
    for (const rem of progress.remaining.slice(0, 2)) {
      const gapKey = `goal_${goal.id}_${normalizeKey(rem.term)}`;
      if (!seenGaps.has(gapKey)) {
        seenGaps.add(gapKey);
        gaps.push({
          id: gapKey,
          type: 'goal_milestone',
          term: rem.term,
          category: goal.category,
          title: `Goal Milestone: ${rem.term}`,
          description: `Towards your learning goal "${goal.title}", explore "${rem.term}" to advance progress (${progress.completed}/${progress.total} completed).`,
          severity: 'low',
          isInferred: true,
          action: `Explore ${rem.term} for ${goal.title}`,
          goalId: goal.id,
        });
      }
    }
  }

  return gaps;
}
