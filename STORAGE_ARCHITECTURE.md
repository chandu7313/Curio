# Curio — Storage Architecture & Local-First Engine

## 1. Architectural Philosophy

The Curio Knowledge Vault follows a **local-first** storage architecture. User knowledge, notes, code samples, and AI conversation histories are treated as sovereign user assets. 

### Core Architectural Principles:
1. **Zero External Dependency**: The Knowledge Vault functions entirely offline without requiring a remote database, vector store, or third-party cloud service.
2. **Sub-Millisecond Read Latency**: Queries, searches, and updates execute synchronously in memory backed by browser asynchronous storage.
3. **Resilient Adapter Layer**: A unified storage adapter abstracts `chrome.storage.local` while offering an in-memory/localStorage fallback for Node.js test runners and non-extension contexts.
4. **Cloud-Sync Ready**: Clean separation between storage interfaces and UI logic ensures straightforward future cloud synchronization (e.g., encrypted WebDAV or Google Drive).

```
┌────────────────────────────────────────────────────────┐
│                   Curio UI Layer                       │
│  (FloatingOverlay.jsx | LearningHub.jsx | App.jsx)     │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│          Vault Storage API (vaultStorage.js)           │
│  • getVaultConcepts()         • saveVaultConcept()     │
│  • searchVaultConcepts()      • createVaultCollection()│
│  • exportVaultData()          • importVaultData()      │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│           Storage Adapter (storageAdapter)             │
├───────────────────────────┬────────────────────────────┤
│  Primary Runtime:         │  Fallback / Testing:       │
│  chrome.storage.local     │  In-Memory Map &           │
│  (Persistent Browser DB)  │  localStorage Fallback     │
└───────────────────────────┴────────────────────────────┘
```

---

## 2. Data Models & Entity Schemas

### 2.1 `VaultConcept` Entity Schema
Represents an individual unit of saved knowledge, concept, explanation, and code examples.

```javascript
{
  /** Unique concept identifier, prefixed with 'c_' */
  id: "c_m3abc123_x7y9z",
  
  /** Human-readable title of the concept */
  title: "Python Iterable Protocol",
  
  /** Raw selected text highlighted by the user on the webpage */
  selectedText: "iterables",
  
  /** AI explanation payload (Markdown string or structured explanation object) */
  explanation: "An iterable is any object capable of returning its members one at a time...",
  
  /** Code examples extracted automatically or provided explicitly */
  codeExamples: [
    {
      language: "python",
      code: "for item in [1, 2, 3]:\n    print(item)",
      caption: "python example"
    }
  ],
  
  /** Categorization and discovery tags */
  tags: ["Python", "Protocols", "Data Structures"],
  
  /** Broad technical category */
  category: "Python",
  
  /** Associated Collection ID or null if unassigned */
  collectionId: "col_m3def456_a1b2c",
  
  /** Personal user notes and annotations */
  userNotes: "Fundamental to understand before diving into generators and itertools.",
  
  /** Understanding mastery status: 'not_reviewed' | 'need_explanation' | 'understood' */
  understandingStatus: "understood",
  
  /** Optional multi-turn conversation thread associated with this explanation */
  conversationHistory: [
    { role: "user", content: "What is the difference between an iterable and an iterator?" },
    { role: "assistant", content: "An iterable implements __iter__, while an iterator also implements __next__..." }
  ],
  
  /** Origin webpage document title */
  pageTitle: "Python Data Model Documentation",
  
  /** Origin webpage URL (sanitized of sensitive query parameters and tokens) */
  pageUrl: "https://docs.python.org/3/reference/datamodel.html",
  
  /** Epoch millisecond creation timestamp */
  createdAt: 1730648400000,
  
  /** Epoch millisecond last modification timestamp */
  updatedAt: 1730648460000
}
```

### 2.2 `VaultCollection` Entity Schema
Represents a user-defined notebook or folder grouping related concepts.

```javascript
{
  /** Unique collection identifier, prefixed with 'col_' */
  id: "col_m3def456_a1b2c",
  
  /** Display name of the collection */
  name: "Python Mastery",
  
  /** Optional description of the collection's topic */
  description: "Advanced Python internals, memory models, and functional constructs",
  
  /** Hex color code for UI badges and card accents */
  color: "#8b5cf6",
  
  /** Epoch millisecond creation timestamp */
  createdAt: 1730648400000,
  
  /** Epoch millisecond last modification timestamp */
  updatedAt: 1730648400000
}
```

---

## 3. Storage Keys & Namespaces

| Storage Key | Type | Description |
|---|---|---|
| `curio_vault_concepts_v1` | `Array<VaultConcept>` | Primary store of all saved concepts, explanations, and annotations. |
| `curio_vault_collections_v1` | `Array<VaultCollection>` | User-defined collections/notebooks. |

---

## 4. Storage Abstraction Layer (`storageAdapter`)

The `storageAdapter` provides three core asynchronous operations:
- `get(keys: string[])`: Fetches key-value pairs from `chrome.storage.local`. If undefined or throwing, falls back to the in-memory `Map` or `localStorage`.
- `set(items: Record<string, any>)`: Persists items simultaneously to `inMemoryStore` and `chrome.storage.local`. Catches storage quota exceptions and warns cleanly without crashing the UI.
- `remove(keys: string[])`: Deletes keys from both in-memory store and `chrome.storage.local`.

---

## 5. Intelligent Deduplication Engine

When a user bookmarks a concept that has already been explored or saved:
1. **Normalization**: The incoming `selectedText` is trimmed and converted to lowercase.
2. **Matching Strategy**: The vault searches for existing records by:
   - Direct `id` equality (if updating an existing entry).
   - Case-insensitive `selectedText` equality.
3. **Merge Semantics**:
   - The original `id` and `createdAt` timestamps are strictly preserved.
   - New personal notes, tags, and status are merged into the record.
   - Code examples are updated if the new explanation contains richer code snippets.
   - `updatedAt` is updated to `Date.now()`.

---

## 6. Local Search & Filtering Engine

The search engine (`searchVaultConcepts`) executes multi-attribute client-side filtering without heavy external dependencies:

```javascript
// Matches across 6 dimensions simultaneously:
const matches = 
  item.title.toLowerCase().includes(query) ||
  item.selectedText.toLowerCase().includes(query) ||
  item.userNotes.toLowerCase().includes(query) ||
  explanationText.toLowerCase().includes(query) ||
  tagsString.toLowerCase().includes(query) ||
  codeSnippetsString.toLowerCase().includes(query);
```

### Supported Query Filters:
- `collectionId`: Filters by collection ID or `'none'` for unorganized concepts.
- `category`: Exact match against domain categories (`React`, `Python`, `JavaScript`, etc.).
- `tag`: Case-insensitive membership in `item.tags`.
- `understandingStatus`: `'not_reviewed'` | `'need_explanation'` | `'understood'`.
- `sortBy`:
  - `'recently_saved'`: Newest `createdAt` first.
  - `'recently_updated'`: Newest `updatedAt` first.
  - `'title_asc'` / `'title_desc'`: Alphabetical sorting.
  - `'understanding'`: Prioritizes concepts needing explanation over unreviewed and understood concepts.

---

## 7. JSON Export & Import Architecture

### 7.1 Export Payload Structure
Exports the full vault state formatted for backup or transfer:
```json
{
  "app": "Curio Personal Knowledge Vault",
  "version": "1.0.0",
  "exportedAt": "2026-11-03T18:40:00.000Z",
  "stats": {
    "totalConcepts": 24,
    "totalCollections": 3
  },
  "collections": [...],
  "concepts": [...]
}
```

### 7.2 Import Pipeline & Resilience
- **Input Validation**: Verifies JSON syntax and ensures `concepts` is an array.
- **Collection Merging**: Deduplicates collections by `id` and `name`.
- **Concept Merging**: Deduplicates concepts by `id` or `selectedText`, updating existing records while appending new ones.
- **Detailed Summary**: Returns `{ importedConcepts, updatedConcepts, importedCollections }` for instant UI feedback.

---

## 8. Storage Quota & Capacity Planning

- **Chrome Storage Quota**: Default `chrome.storage.local` provides 10 MB of uncompressed JSON storage, which comfortably accommodates 10,000+ detailed concepts and code snippets.
- **Code Block Extraction**: Fenced code blocks are parsed cleanly into structured objects, avoiding redundant HTML overhead.
- **Graceful Quota Handling**: If storage limit errors occur, the adapter catches the exception, logs a warning, and protects against silent state corruption.

