/**
 * Curio — Personal Learning Intelligence & Glossary Service
 *
 * Manages the user's personal knowledge base, glossary, understanding levels,
 * saved explanations, and learning history.
 *
 * Persistence:
 *  - Primary: chrome.storage.local (100% offline, zero-account-required)
 *  - Cloud (Optional): PostgreSQL schema provided for authenticated sync
 *
 * Privacy & Consent:
 *  - Full JSON export
 *  - Complete data erasure
 *
 * @module services/learningService
 */

import { inferConceptCategory, getRelatedConcepts } from './knowledgeGraph.js';

const GLOSSARY_STORAGE_KEY = 'curio_learning_glossary_v1';

/**
 * @typedef {'need_explanation'|'reviewing'|'understood'} UnderstandingLevel
 */

/**
 * @typedef {Object} LearningConcept
 * @property {string} id - Unique identifier
 * @property {string} term - Normalized display term
 * @property {string} selectedText - Raw selected text snippet
 * @property {string} category - Classification (e.g., Python, React, Architecture)
 * @property {UnderstandingLevel} understandingLevel - Explicit user comprehension state
 * @property {boolean} isSaved - Whether saved/bookmarked for later
 * @property {string} notes - User annotations
 * @property {number} exploreCount - Number of times encountered/explored
 * @property {number} firstExploredAt - Initial discovery timestamp
 * @property {number} lastExploredAt - Most recent view timestamp
 * @property {Object} explanation - Latest formatted explanation snapshot
 * @property {Array<{ term: string, relation: string, label: string }>} relatedConcepts
 * @property {string} pageTitle - Source document title
 * @property {string} pageUrl - Source sanitized URL
 */

/**
 * Retrieve raw glossary array from local storage.
 * @returns {Promise<LearningConcept[]>}
 */
export async function getGlossary() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const data = await chrome.storage.local.get([GLOSSARY_STORAGE_KEY]);
      return data[GLOSSARY_STORAGE_KEY] || [];
    }
  } catch (err) {
    console.warn('[Curio Learning] Storage read failed:', err);
  }
  return [];
}

/**
 * Save full glossary array to local storage.
 * @param {LearningConcept[]} list
 * @returns {Promise<boolean>}
 */
async function saveGlossary(list) {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [GLOSSARY_STORAGE_KEY]: list });
      return true;
    }
  } catch (err) {
    console.warn('[Curio Learning] Storage write failed:', err);
  }
  return false;
}

/**
 * Clean & normalize a concept term.
 * @param {string} text
 * @returns {string}
 */
function normalizeTerm(text) {
  const trimmed = (text || '').trim();
  if (trimmed.length > 50) {
    return trimmed.slice(0, 47) + '...';
  }
  return trimmed;
}

/**
 * Record an exploration event.
 * If the concept already exists, increments exploreCount and updates timestamp.
 * If new, creates a new entry with explicit understanding level 'reviewing'.
 *
 * @param {Object} context
 * @param {string} context.selectedText
 * @param {string} [context.contentType]
 * @param {string|null} [context.language]
 * @param {string} [context.pageTitle]
 * @param {string} [context.pageUrl]
 * @param {Object} explanation
 * @returns {Promise<LearningConcept>}
 */
export async function recordConceptExploration(context, explanation) {
  const glossary = await getGlossary();
  const rawText = (context.selectedText || '').trim();
  const normalized = normalizeTerm(rawText);

  // Match existing by exact text or normalized term
  const existingIndex = glossary.findIndex(
    (item) => item.selectedText.trim().toLowerCase() === rawText.toLowerCase() ||
              item.term.toLowerCase() === normalized.toLowerCase()
  );

  const category = inferConceptCategory(rawText, context.language);
  const related = getRelatedConcepts(rawText, category);
  const now = Date.now();

  let targetConcept = null;

  if (existingIndex >= 0) {
    const existing = glossary[existingIndex];
    targetConcept = {
      ...existing,
      exploreCount: (existing.exploreCount || 1) + 1,
      lastExploredAt: now,
      explanation: explanation || existing.explanation,
      relatedConcepts: related.length > 0 ? related : existing.relatedConcepts,
      pageTitle: context.pageTitle || existing.pageTitle,
      pageUrl: context.pageUrl || existing.pageUrl,
    };
    glossary[existingIndex] = targetConcept;
  } else {
    targetConcept = {
      id: `c_${now}_${Math.random().toString(36).slice(2, 7)}`,
      term: normalized,
      selectedText: rawText,
      category,
      understandingLevel: 'reviewing', // Default: In progress (never assume mastery)
      isSaved: false,
      notes: '',
      exploreCount: 1,
      firstExploredAt: now,
      lastExploredAt: now,
      explanation,
      relatedConcepts: related,
      pageTitle: context.pageTitle || '',
      pageUrl: context.pageUrl || '',
    };
    glossary.unshift(targetConcept);
  }

  await saveGlossary(glossary);
  return targetConcept;
}

/**
 * Find an existing concept by selected text.
 * @param {string} text
 * @returns {Promise<LearningConcept|null>}
 */
export async function getConceptByText(text) {
  if (!text) return null;
  const glossary = await getGlossary();
  const target = text.trim().toLowerCase();
  return (
    glossary.find(
      (c) => c.selectedText.trim().toLowerCase() === target ||
             c.term.toLowerCase() === target
    ) || null
  );
}

/**
 * Explicitly update the user's understanding level for a concept.
 *
 * @param {string} id
 * @param {UnderstandingLevel} level
 * @returns {Promise<LearningConcept|null>}
 */
export async function updateUnderstandingLevel(id, level) {
  const glossary = await getGlossary();
  const index = glossary.findIndex((c) => c.id === id);
  if (index === -1) return null;

  glossary[index].understandingLevel = level;
  glossary[index].lastExploredAt = Date.now();
  await saveGlossary(glossary);
  return glossary[index];
}

/**
 * Toggle the "Save for Later" bookmark status for a concept.
 *
 * @param {string} id
 * @returns {Promise<boolean>} New saved state
 */
export async function toggleSaveConcept(id) {
  const glossary = await getGlossary();
  const index = glossary.findIndex((c) => c.id === id);
  if (index === -1) return false;

  const newSaved = !glossary[index].isSaved;
  glossary[index].isSaved = newSaved;
  await saveGlossary(glossary);
  return newSaved;
}

/**
 * Update personal notes for a concept.
 *
 * @param {string} id
 * @param {string} notes
 * @returns {Promise<LearningConcept|null>}
 */
export async function updateConceptNotes(id, notes) {
  const glossary = await getGlossary();
  const index = glossary.findIndex((c) => c.id === id);
  if (index === -1) return null;

  glossary[index].notes = notes;
  await saveGlossary(glossary);
  return glossary[index];
}

/**
 * Delete a single concept from personal learning history.
 *
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteConcept(id) {
  const glossary = await getGlossary();
  const filtered = glossary.filter((c) => c.id !== id);
  await saveGlossary(filtered);
  return true;
}

/**
 * Search and filter glossary entries.
 *
 * @param {string} query - Free text search query
 * @param {Object} [filters]
 * @param {string} [filters.category] - Filter by specific category ('All' for any)
 * @param {string} [filters.understandingLevel] - Filter by level ('All' for any)
 * @param {boolean} [filters.savedOnly] - Restrict to saved items
 * @returns {Promise<LearningConcept[]>}
 */
export async function searchGlossary(query = '', filters = {}) {
  const glossary = await getGlossary();
  const q = query.trim().toLowerCase();
  const { category = 'All', understandingLevel = 'All', savedOnly = false } = filters;

  return glossary.filter((item) => {
    // Saved filter
    if (savedOnly && !item.isSaved) return false;

    // Category filter
    if (category !== 'All' && item.category !== category) return false;

    // Understanding level filter
    if (understandingLevel !== 'All' && item.understandingLevel !== understandingLevel) {
      return false;
    }

    // Text search filter
    if (!q) return true;

    return (
      item.term.toLowerCase().includes(q) ||
      item.selectedText.toLowerCase().includes(q) ||
      (item.notes && item.notes.toLowerCase().includes(q)) ||
      (item.explanation?.summary && item.explanation.summary.toLowerCase().includes(q)) ||
      item.category.toLowerCase().includes(q)
    );
  });
}

/**
 * Calculate learning metrics & progress statistics.
 *
 * @returns {Promise<Object>}
 */
export async function getLearningStats() {
  const glossary = await getGlossary();
  const total = glossary.length;

  const understoodCount = glossary.filter(
    (c) => c.understandingLevel === 'understood' || c.understandingStatus === 'understood'
  ).length;
  const reviewingCount = glossary.filter(
    (c) => c.understandingLevel === 'reviewing' || c.understandingLevel === 'learning' ||
           c.understandingStatus === 'reviewing' || c.understandingStatus === 'learning'
  ).length;
  const needExplanationCount = glossary.filter(
    (c) => c.understandingLevel === 'need_explanation' || c.understandingLevel === 'needs_revision' ||
           c.understandingStatus === 'need_explanation' || c.understandingStatus === 'needs_revision'
  ).length;
  const notReviewedCount = glossary.filter(
    (c) => c.understandingLevel === 'not_reviewed' || c.understandingStatus === 'not_reviewed'
  ).length;
  const savedCount = glossary.filter((c) => c.isSaved).length;

  // Category counts
  const categoryCounts = {};
  for (const item of glossary) {
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
  }

  // Mastery percentage (understood / total)
  const masteryPercentage = total > 0 ? Math.round((understoodCount / total) * 100) : 0;

  return {
    totalConcepts: total,
    understoodCount,
    reviewingCount,
    learningCount: reviewingCount,
    needExplanationCount,
    needsRevisionCount: needExplanationCount,
    notReviewedCount,
    savedCount,
    categoryCounts,
    masteryPercentage,
    recentlyExplored: glossary.slice(0, 5),
  };
}

/**
 * Export complete learning intelligence data as formatted JSON.
 * @returns {Promise<string>}
 */
export async function exportLearningData() {
  const glossary = await getGlossary();
  const exportPayload = {
    app: 'Curio Personal Learning Assistant',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    totalConcepts: glossary.length,
    glossary,
  };
  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Clear all personal learning data (Privacy & User Consent).
 * @returns {Promise<boolean>}
 */
export async function clearLearningData() {
  await saveGlossary([]);
  return true;
}

