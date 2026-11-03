/**
 * Curio — Personal Knowledge Vault Storage & Local-First Engine
 *
 * Local-first persistence engine utilizing chrome.storage.local with
 * robust in-memory / localStorage fallback for test and non-extension environments.
 *
 * Data Entities:
 *  - VaultConcept: Structured, searchable knowledge entries
 *  - VaultCollection: User-created notebooks/folders
 *
 * Features:
 *  - Save explanations, code blocks, tags, notes, and conversation threads
 *  - Multi-attribute fast local search across titles, terms, explanations, notes, tags
 *  - Collection management (create, update, delete, assign)
 *  - Status tracking ('not_reviewed' | 'need_explanation' | 'understood')
 *  - JSON Export & Import with schema validation and deduplication
 *  - Clean storage abstraction ready for future cloud sync adapters
 *
 * @module shared/services/vaultStorage
 */

export const VAULT_CONCEPTS_KEY = 'curio_vault_concepts_v1';
export const VAULT_COLLECTIONS_KEY = 'curio_vault_collections_v1';

// In-memory fallback for Node.js test environments or non-extension runtimes
const inMemoryStore = new Map();

/**
 * Low-level storage adapter with chrome.storage.local / in-memory compatibility.
 */
export const storageAdapter = {
  async get(keys) {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        return await chrome.storage.local.get(keys);
      } catch (err) {
        console.warn('[Curio Vault] chrome.storage.local get failed:', err);
      }
    }
    const result = {};
    for (const key of keys) {
      if (inMemoryStore.has(key)) {
        result[key] = inMemoryStore.get(key);
      } else if (typeof localStorage !== 'undefined') {
        try {
          const val = localStorage.getItem(key);
          if (val) result[key] = JSON.parse(val);
        } catch (_) {}
      }
    }
    return result;
  },

  async set(items) {
    for (const [key, val] of Object.entries(items)) {
      inMemoryStore.set(key, val);
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(key, JSON.stringify(val));
        } catch (_) {}
      }
    }
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        await chrome.storage.local.set(items);
        return true;
      } catch (err) {
        console.warn('[Curio Vault] chrome.storage.local set failed:', err);
      }
    }
    return true;
  },

  async remove(keys) {
    for (const key of keys) {
      inMemoryStore.delete(key);
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem(key);
        } catch (_) {}
      }
    }
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        await chrome.storage.local.remove(keys);
        return true;
      } catch (err) {
        console.warn('[Curio Vault] chrome.storage.local remove failed:', err);
      }
    }
    return true;
  },
};

/**
 * Normalize understanding status across modern and legacy values.
 *  - 'needs_revision' (modern) & 'need_explanation' (legacy)
 *  - 'learning' (modern) & 'reviewing' (legacy)
 *  - 'understood'
 *  - 'not_reviewed' (default)
 *
 * @param {string} status
 * @returns {'not_reviewed'|'learning'|'understood'|'needs_revision'}
 */
export function normalizeUnderstandingStatus(status) {
  const s = (status || '').toLowerCase().trim();
  if (s === 'need_explanation' || s === 'needs_revision') return 'needs_revision';
  if (s === 'reviewing' || s === 'learning') return 'learning';
  if (s === 'understood') return 'understood';
  return 'not_reviewed';
}

/**
 * Generate a unique identifier with optional prefix.
 * @param {string} [prefix='c']
 * @returns {string}
 */
export function generateVaultId(prefix = 'c') {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 7);
  return `${prefix}_${ts}_${rand}`;
}

/**
 * Extract code blocks from a markdown explanation.
 *
 * @param {string} markdown
 * @returns {Array<{ code: string, language: string, caption?: string }>}
 */
export function extractCodeBlocks(markdown = '') {
  if (!markdown || typeof markdown !== 'string') return [];
  const regex = /```([a-zA-Z0-9_-]*)[^\S\r\n]*\r?\n([\s\S]*?)```/g;
  const blocks = [];
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    const language = match[1] || 'text';
    const code = match[2].trim();
    if (code) {
      blocks.push({
        language,
        code,
        caption: `${language} example`,
      });
    }
  }
  return blocks;
}

// ─── Concept Operations ─────────────────────────────────────────────

/**
 * Retrieve all saved concepts from the vault.
 * @returns {Promise<Array<Object>>}
 */
export async function getVaultConcepts() {
  const data = await storageAdapter.get([VAULT_CONCEPTS_KEY]);
  return data[VAULT_CONCEPTS_KEY] || [];
}

/**
 * Retrieve a specific concept by its ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getConceptById(id) {
  if (!id) return null;
  const concepts = await getVaultConcepts();
  return concepts.find((c) => c.id === id) || null;
}

/**
 * Save or update a concept in the Knowledge Vault.
 * Performs intelligent deduplication by selectedText or ID.
 *
 * @param {Object} conceptData
 * @param {string} conceptData.selectedText
 * @param {string} [conceptData.title]
 * @param {string|Object} [conceptData.explanation]
 * @param {Array<Object>} [conceptData.codeExamples]
 * @param {Array<string>} [conceptData.tags]
 * @param {string} [conceptData.category]
 * @param {string|null} [conceptData.collectionId]
 * @param {string} [conceptData.userNotes]
 * @param {'not_reviewed'|'need_explanation'|'understood'} [conceptData.understandingStatus]
 * @param {Array<Object>} [conceptData.conversationHistory]
 * @param {string} [conceptData.pageTitle]
 * @param {string} [conceptData.pageUrl]
 * @returns {Promise<Object>} The saved concept
 */
export async function saveVaultConcept(conceptData) {
  const concepts = await getVaultConcepts();
  const rawText = (conceptData.selectedText || conceptData.term || '').trim();
  const now = Date.now();

  // Find existing by ID or matching normalized selectedText
  const existingIdx = concepts.findIndex(
    (c) => (conceptData.id && c.id === conceptData.id) ||
           (c.selectedText && c.selectedText.toLowerCase() === rawText.toLowerCase())
  );

  // Extract explanation text and code blocks
  const explanationText = typeof conceptData.explanation === 'string'
    ? conceptData.explanation
    : conceptData.explanation?.summary || conceptData.explanation?.title || '';

  const extractedCode = conceptData.codeExamples?.length > 0
    ? conceptData.codeExamples
    : extractCodeBlocks(explanationText);

  // Derive title if missing
  const title = conceptData.title ||
    (rawText.length > 50 ? rawText.slice(0, 47) + '...' : rawText);

  // Derive initial tags from category & language
  const defaultTags = [];
  if (conceptData.category && conceptData.category !== 'General') {
    defaultTags.push(conceptData.category);
  }
  if (conceptData.language) {
    defaultTags.push(conceptData.language);
  }
  const mergedTags = Array.from(new Set([...(conceptData.tags || []), ...defaultTags]));

  let savedConcept;

  if (existingIdx >= 0) {
    const existing = concepts[existingIdx];
    savedConcept = {
      ...existing,
      title: conceptData.title || existing.title || title,
      selectedText: rawText || existing.selectedText,
      explanation: conceptData.explanation || existing.explanation,
      codeExamples: extractedCode.length > 0 ? extractedCode : existing.codeExamples || [],
      tags: mergedTags.length > 0 ? mergedTags : existing.tags || [],
      category: conceptData.category || existing.category || 'General',
      collectionId: conceptData.collectionId !== undefined ? conceptData.collectionId : existing.collectionId || null,
      userNotes: conceptData.userNotes !== undefined ? conceptData.userNotes : existing.userNotes || '',
      understandingStatus: conceptData.understandingStatus || existing.understandingStatus || 'not_reviewed',
      conversationHistory: conceptData.conversationHistory || existing.conversationHistory || [],
      pageTitle: conceptData.pageTitle || existing.pageTitle || '',
      pageUrl: conceptData.pageUrl || existing.pageUrl || '',
      updatedAt: now,
    };
    concepts[existingIdx] = savedConcept;
  } else {
    savedConcept = {
      id: conceptData.id || generateVaultId('c'),
      title,
      selectedText: rawText,
      explanation: conceptData.explanation || {},
      codeExamples: extractedCode,
      tags: mergedTags,
      category: conceptData.category || 'General',
      collectionId: conceptData.collectionId || null,
      userNotes: conceptData.userNotes || '',
      understandingStatus: conceptData.understandingStatus || 'not_reviewed',
      conversationHistory: conceptData.conversationHistory || [],
      createdAt: now,
      updatedAt: now,
      pageTitle: conceptData.pageTitle || '',
      pageUrl: conceptData.pageUrl || '',
    };
    concepts.unshift(savedConcept);
  }

  await storageAdapter.set({ [VAULT_CONCEPTS_KEY]: concepts });
  return savedConcept;
}

/**
 * Partially update an existing concept.
 *
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<Object|null>}
 */
export async function updateVaultConcept(id, updates) {
  if (!id) return null;
  const concepts = await getVaultConcepts();
  const idx = concepts.findIndex((c) => c.id === id);
  if (idx === -1) return null;

  const existing = concepts[idx];
  const updated = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  };

  concepts[idx] = updated;
  await storageAdapter.set({ [VAULT_CONCEPTS_KEY]: concepts });
  return updated;
}

/**
 * Delete a concept from the vault.
 *
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteVaultConcept(id) {
  if (!id) return false;
  const concepts = await getVaultConcepts();
  const filtered = concepts.filter((c) => c.id !== id);
  await storageAdapter.set({ [VAULT_CONCEPTS_KEY]: filtered });
  return true;
}

// ─── Collection Operations ──────────────────────────────────────────

/**
 * Retrieve all custom collections.
 * @returns {Promise<Array<Object>>}
 */
export async function getVaultCollections() {
  const data = await storageAdapter.get([VAULT_COLLECTIONS_KEY]);
  return data[VAULT_COLLECTIONS_KEY] || [];
}

/**
 * Create a new custom collection (notebook / folder).
 *
 * @param {Object} collectionData
 * @param {string} collectionData.name
 * @param {string} [collectionData.description]
 * @param {string} [collectionData.color]
 * @returns {Promise<Object>}
 */
export async function createVaultCollection(collectionData) {
  const collections = await getVaultCollections();
  const now = Date.now();
  const name = (collectionData.name || 'Untitled Collection').trim();

  const newCol = {
    id: collectionData.id || generateVaultId('col'),
    name,
    description: (collectionData.description || '').trim(),
    color: collectionData.color || '#0d9488', // Default teal
    createdAt: now,
    updatedAt: now,
  };

  collections.push(newCol);
  await storageAdapter.set({ [VAULT_COLLECTIONS_KEY]: collections });
  return newCol;
}

/**
 * Update an existing collection.
 *
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<Object|null>}
 */
export async function updateVaultCollection(id, updates) {
  if (!id) return null;
  const collections = await getVaultCollections();
  const idx = collections.findIndex((c) => c.id === id);
  if (idx === -1) return null;

  const updated = {
    ...collections[idx],
    ...updates,
    updatedAt: Date.now(),
  };

  collections[idx] = updated;
  await storageAdapter.set({ [VAULT_COLLECTIONS_KEY]: collections });
  return updated;
}

/**
 * Delete a collection. Unassigns concepts linked to it without deleting the concepts.
 *
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteVaultCollection(id) {
  if (!id) return false;
  const collections = await getVaultCollections();
  const filteredCols = collections.filter((c) => c.id !== id);
  await storageAdapter.set({ [VAULT_COLLECTIONS_KEY]: filteredCols });

  // Unlink concepts belonging to this collection
  const concepts = await getVaultConcepts();
  let modified = false;
  for (const c of concepts) {
    if (c.collectionId === id) {
      c.collectionId = null;
      modified = true;
    }
  }
  if (modified) {
    await storageAdapter.set({ [VAULT_CONCEPTS_KEY]: concepts });
  }

  return true;
}

// ─── Search & Query Engine ──────────────────────────────────────────

/**
 * Execute client-side multi-attribute search and filtering over the vault.
 *
 * @param {Object} [params]
 * @param {string} [params.query] - Free-text search query
 * @param {string} [params.category] - Filter by category ('All' for any)
 * @param {string} [params.tag] - Filter by tag ('All' for any)
 * @param {string} [params.collectionId] - Filter by collection ID ('All' for any)
 * @param {string} [params.understandingStatus] - 'not_reviewed' | 'need_explanation' | 'understood' | 'All'
 * @param {string} [params.sortBy] - 'recently_saved' | 'recently_updated' | 'title_asc' | 'title_desc' | 'understanding'
 * @returns {Promise<Array<Object>>}
 */
export async function searchVaultConcepts(params = {}) {
  const concepts = await getVaultConcepts();
  const {
    query = '',
    category = 'All',
    tag = 'All',
    collectionId = 'All',
    understandingStatus = 'All',
    sortBy = 'recently_saved',
  } = params;

  const q = query.trim().toLowerCase();

  const filtered = concepts.filter((item) => {
    // Collection filter
    if (collectionId !== 'All') {
      if (collectionId === 'none' && item.collectionId) return false;
      if (collectionId !== 'none' && item.collectionId !== collectionId) return false;
    }

    // Category filter
    if (category !== 'All' && item.category !== category) return false;

    // Tag filter
    if (tag !== 'All') {
      const itemTags = (item.tags || []).map((t) => t.toLowerCase());
      if (!itemTags.includes(tag.toLowerCase())) return false;
    }

    // Understanding status filter
    if (understandingStatus !== 'All') {
      const currentNorm = normalizeUnderstandingStatus(item.understandingStatus || item.understandingLevel);
      const targetNorm = normalizeUnderstandingStatus(understandingStatus);
      if (currentNorm !== targetNorm && item.understandingStatus !== understandingStatus && item.understandingLevel !== understandingStatus) {
        return false;
      }
    }

    // Free text search
    if (!q) return true;

    const explanationStr = typeof item.explanation === 'string'
      ? item.explanation
      : JSON.stringify(item.explanation || '');

    const tagsStr = (item.tags || []).join(' ');
    const codeStr = (item.codeExamples || []).map((b) => `${b.code} ${b.caption || ''}`).join(' ');

    return (
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.selectedText && item.selectedText.toLowerCase().includes(q)) ||
      (item.userNotes && item.userNotes.toLowerCase().includes(q)) ||
      explanationStr.toLowerCase().includes(q) ||
      tagsStr.toLowerCase().includes(q) ||
      codeStr.toLowerCase().includes(q)
    );
  });

  // Sorting
  filtered.sort((a, b) => {
    switch (sortBy) {
      case 'recently_updated':
        return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
      case 'title_asc':
        return (a.title || '').localeCompare(b.title || '');
      case 'title_desc':
        return (b.title || '').localeCompare(a.title || '');
      case 'understanding': {
        const order = {
          needs_revision: 0,
          need_explanation: 0,
          learning: 1,
          reviewing: 1,
          not_reviewed: 2,
          understood: 3,
        };
        const scoreA = order[a.understandingStatus] !== undefined ? order[a.understandingStatus] : (order[a.understandingLevel] ?? 2);
        const scoreB = order[b.understandingStatus] !== undefined ? order[b.understandingStatus] : (order[b.understandingLevel] ?? 2);
        return scoreA - scoreB;
      }
      case 'recently_saved':
      default:
        return (b.createdAt || 0) - (a.createdAt || 0);
    }
  });

  return filtered;
}

// ─── Export & Import ────────────────────────────────────────────────

/**
 * Export complete knowledge vault as a formatted JSON string.
 *
 * @returns {Promise<string>}
 */
export async function exportVaultData() {
  const [concepts, collections] = await Promise.all([
    getVaultConcepts(),
    getVaultCollections(),
  ]);

  const payload = {
    app: 'Curio Personal Knowledge Vault',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    stats: {
      totalConcepts: concepts.length,
      totalCollections: collections.length,
    },
    collections,
    concepts,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Import knowledge vault data from JSON payload.
 *
 * @param {string|Object} rawData - JSON string or parsed object
 * @param {Object} [options]
 * @param {boolean} [options.merge=true] - Whether to merge with existing data or overwrite
 * @returns {Promise<{ importedConcepts: number, updatedConcepts: number, importedCollections: number }>}
 */
export async function importVaultData(rawData, options = { merge: true }) {
  let parsed;
  try {
    parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
  } catch (err) {
    throw new Error(`Invalid JSON format: ${err.message}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Import data must be a valid JSON object.');
  }

  const incomingConcepts = parsed.concepts || parsed.glossary || [];
  const incomingCollections = parsed.collections || [];

  if (!Array.isArray(incomingConcepts)) {
    throw new Error('Malformed payload: concepts must be an array.');
  }

  let existingConcepts = options.merge ? await getVaultConcepts() : [];
  let existingCollections = options.merge ? await getVaultCollections() : [];

  let importedCollections = 0;
  for (const col of incomingCollections) {
    if (!col || !col.name) continue;
    const exists = existingCollections.some((c) => c.id === col.id || c.name === col.name);
    if (!exists) {
      existingCollections.push({
        id: col.id || generateVaultId('col'),
        name: col.name.trim(),
        description: col.description || '',
        color: col.color || '#0d9488',
        createdAt: col.createdAt || Date.now(),
        updatedAt: col.updatedAt || Date.now(),
      });
      importedCollections++;
    }
  }

  let importedConcepts = 0;
  let updatedConcepts = 0;

  for (const inc of incomingConcepts) {
    const rawText = (inc.selectedText || inc.term || '').trim();
    if (!rawText) continue;

    const existingIdx = existingConcepts.findIndex(
      (c) => (inc.id && c.id === inc.id) ||
             (c.selectedText && c.selectedText.toLowerCase() === rawText.toLowerCase())
    );

    const title = inc.title || inc.term || (rawText.length > 50 ? rawText.slice(0, 47) + '...' : rawText);
    const codeExamples = inc.codeExamples || (typeof inc.explanation === 'string' ? extractCodeBlocks(inc.explanation) : []);

    if (existingIdx >= 0) {
      // Merge updates into existing
      existingConcepts[existingIdx] = {
        ...existingConcepts[existingIdx],
        ...inc,
        title,
        codeExamples: codeExamples.length > 0 ? codeExamples : existingConcepts[existingIdx].codeExamples,
        updatedAt: Date.now(),
      };
      updatedConcepts++;
    } else {
      existingConcepts.unshift({
        id: inc.id || generateVaultId('c'),
        title,
        selectedText: rawText,
        explanation: inc.explanation || {},
        codeExamples,
        tags: Array.isArray(inc.tags) ? inc.tags : [],
        category: inc.category || 'General',
        collectionId: inc.collectionId || null,
        userNotes: inc.userNotes || inc.notes || '',
        understandingStatus: inc.understandingStatus || inc.understandingLevel || 'not_reviewed',
        conversationHistory: inc.conversationHistory || [],
        createdAt: inc.createdAt || inc.firstExploredAt || Date.now(),
        updatedAt: inc.updatedAt || inc.lastExploredAt || Date.now(),
        pageTitle: inc.pageTitle || '',
        pageUrl: inc.pageUrl || '',
      });
      importedConcepts++;
    }
  }

  await storageAdapter.set({
    [VAULT_COLLECTIONS_KEY]: existingCollections,
    [VAULT_CONCEPTS_KEY]: existingConcepts,
  });

  return {
    importedConcepts,
    updatedConcepts,
    importedCollections,
  };
}

/**
 * Clear all knowledge vault concepts and collections.
 * @returns {Promise<boolean>}
 */
export async function clearVaultData() {
  await storageAdapter.remove([VAULT_CONCEPTS_KEY, VAULT_COLLECTIONS_KEY]);
  return true;
}
