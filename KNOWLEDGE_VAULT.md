# Curio — Personal Knowledge Vault

## 1. Executive Summary & Product Objective

The **Curio Personal Knowledge Vault** is a local-first, privacy-respecting knowledge management system integrated directly into the Curio browser extension. As users browse the web, read technical documentation, review GitHub code, or interact with AI platforms, they inevitably encounter unfamiliar concepts, syntaxes, algorithms, or architectural patterns. 

With Curio's Knowledge Vault, users can instantly capture AI-generated explanations, code examples, personal annotations, and conversational follow-up threads, organizing them into a unified, searchable, and structured personal knowledge library.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Curio Knowledge Vault                           │
├────────────────────────────────────────────────────────────────────────┤
│  [🔍 Search concepts, code, tags...] [Category: All] [Status: Filter]  │
├─────────────┬──────────────────────────────────────────────────────────┤
│ COLLECTIONS │ SAVED CONCEPTS GRID                                      │
│ • All Vault │ ┌──────────────────────────┐ ┌──────────────────────────┐│
│ • Python    │ │ Python Iterable          │ │ React useMemo Hook       ││
│ • React     │ │ "iterables"              │ │ "useMemo"                ││
│ • Algorithms│ │ Status: Understood       │ │ Status: Review Needed    ││
│ • + New Col │ │ Tags: [Python] [Protocols│ │ Tags: [React] [Hooks]    ││
│             │ │ Code: 1 example          │ │ Code: 1 example          ││
│             │ └──────────────────────────┘ └──────────────────────────┘│
└─────────────┴──────────────────────────────────────────────────────────┘
```

---

## 2. Core User Experience Walkthrough

### Scenario: Exploring Modern Python Concurrency & Functional Constructs
1. **Selection & Instant Explanation**:
   - The user highlights `Python map()` in a tutorial.
   - Curio's floating overlay streams an explanation detailing its behavior, signature, and laziness in Python 3.
2. **Contextual Follow-up**:
   - The user asks: *"What is the difference between map() and filter()?"* followed by *"Show me an example using lambda."*
   - Curio maintains conversational context across each turn.
3. **One-Click Vault Save**:
   - The user clicks the **Bookmark** icon in the overlay header.
   - The concept (`Python map()`), the streaming explanation, the auto-extracted Python code blocks, the active follow-up conversation thread, and source page metadata (`pageTitle`, `pageUrl`) are committed to the Knowledge Vault.
4. **Knowledge Organization in Learning Hub**:
   - The user opens the Knowledge Vault options dashboard (`chrome-extension://.../options.html`).
   - The concept appears with metric counters (`Total in Vault: 1`, `Not Reviewed: 1`).
   - The user creates a new collection titled **"Python Internals"** with purple accent color and assigns the concept.
   - The user appends custom notes: *"Remember that in Python 3, map returns a generator iterator; cast with list() if random access is needed."*
   - The user tags it with `#functional` and marks the status as **Understood**.

---

## 3. Comprehensive Feature Set

| # | Feature | Implementation Detail |
|---|---|---|
| **1** | **Save AI Explanation** | Captures complete markdown explanation, including key takeaways and nuances. |
| **2** | **Save Selected Concept** | Records the verbatim highlighted text snippet, sanitized page URL, and page title. |
| **3** | **Extract & Save Code Examples** | Automatic regex extraction of fenced code blocks (` ```lang ... ``` `) into interactive syntax-highlighted code blocks with individual copy buttons. |
| **4** | **Save Follow-up Conversations** | Persists multi-turn conversational Q&A threads linked to the root concept. |
| **5** | **Custom Collections** | Notebooks/folders with customizable names, descriptions, and color accents (Teal, Purple, Indigo, Emerald, Amber, Rose, Sky). |
| **6** | **Interactive Tagging** | Flexible tag chips per concept with quick removal (`×`) and addition modal. |
| **7** | **Personal Notes Editor** | Markdown/prose notes editor with live auto-save feedback. |
| **8** | **Multi-Attribute Local Search** | Instant sub-millisecond search across title, selected terminology, explanation body, personal notes, code snippets, and tags. |
| **9** | **Category Filtering** | Fast filtering by tech domain (`React`, `Python`, `JavaScript`, `Architecture`, `Algorithms`, `Security`, `Web Standards`, `General`). |
| **10** | **Multi-Criteria Sorting** | Sort by Recently Saved, Recently Updated, Title (A-Z, Z-A), and Understanding Urgency. |
| **11** | **Understanding Status Tracking** | Three distinct learning stages: `not_reviewed` (Inbox), `need_explanation` (Review Needed), and `understood` (Mastered). |
| **12** | **Delete & Clean** | Individual concept deletion with instant UI update and zero orphaned storage artifacts. |
| **13** | **JSON Knowledge Export** | Formatted JSON dump of entire vault (concepts, collections, timestamps, tags, notes). |
| **14** | **JSON Knowledge Import** | Robust JSON file ingestion with automatic schema validation, structure parsing, and deduplication. |

---

## 4. UI Architecture & Components

The Knowledge Vault interface is implemented in pure React 19 JSX (`src/options/LearningHub.jsx`) without external UI library bloat:

- **Metrics Overview Bar**: Displays live counts of Total Saved Concepts, Mastered Concepts, Concepts Needing Review, and Unreviewed Inbox items.
- **Collections Sidebar & Tabs**: Fast switching between "All Concepts", custom collections, or "Unorganized" items.
- **Search & Filter Toolbar**: Combines free-text search input with Category dropdown, Status filter buttons, Tag pills, and Sort selector.
- **Concept Card Grid**: Responsive grid rendering concept badges, preview snippets, tag chips, code counts, date saved, and quick understanding status toggles.
- **Detail Slide-Over Modal**: Deep-dive inspection modal containing:
  - Header with source URL link, collection switcher, and delete action.
  - Understanding Status segmented controller.
  - Tab 1: **Explanation** (Rich `MarkdownRenderer` with typography styling).
  - Tab 2: **Code Examples** (Individual blocks with language indicator and copy-to-clipboard action).
  - Tab 3: **Personal Notes** (Interactive editable textarea with timestamp updates).
  - Tab 4: **Follow-Up Thread** (Transcript of follow-up questions and answers).
- **Import / Export Actions**: Quick export trigger (generates `.json` download) and import button (triggers native file picker with merge confirmation).

---

## 5. Privacy & Data Ownership

- **100% Local Storage**: All concepts, collections, and notes reside strictly in the user's browser via `chrome.storage.local`.
- **Zero Remote Tracking**: Saved explanations are never transmitted to external telemetry servers or remote databases.
- **Explicit User Action Only**: Vault entries are created solely when the user clicks the bookmark icon or imports a file.
- **Complete Erasure & Exportability**: Users can export their entire knowledge base at any time and wipe all local vault data with one click.

