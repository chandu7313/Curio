# Curio — Adaptive Learning Intelligence Engine

## 1. Executive Summary & Objective

Curio's **Adaptive Learning Intelligence Engine** transforms Curio from an in-situ text explanation tool into a personalized, proactive learning copilot. Rather than treating highlighted webpage concepts in isolation, Curio maps semantic connections between concepts, detects knowledge gaps, curates next-step learning recommendations, and visualizes personalized learning trajectories.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Curio Adaptive Learning Intelligence                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  [📚 Knowledge Vault]     [⚡ Learning Intelligence]    [🕸 Concept Graph]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  GAP DETECTION CENTER                                                       │
│  ⚠️ Inferred Suggestion: Prerequisite Gap: Iterators (needed for Generators)│
│  🔄 Inferred Suggestion: Frequently Revisited: Decorators (4 views)         │
├──────────────────────────────────────┬──────────────────────────────────────┤
│  ACTIVE LEARNING GOALS               │  SEMANTIC LEARNING PATHS             │
│  🎯 Python Concurrency & Iteration   │  📁 Python Iteration Protocol        │
│     [████████░░░░░░░░░░] 43%         │     Iterables → Iterators →          │
│     Target: Iterables, Iterators,    │     Generators → Lazy evaluation     │
│             Generators, Coroutines   │  📁 React Performance & Memoization  │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

---

## 2. Core Pillars & Architecture

### 2.1 Concept Relationship Engine
Curio connects concepts through a 5-tier technical relationship taxonomy:
- **`prerequisite`**: Concept A must be mastered before Concept B (e.g., `Iterables` $\rightarrow$ `Iterators`).
- **`related`**: Concepts complementary in idiomatic engineering practice (e.g., `yield statement` $\leftrightarrow$ `Generators`).
- **`advanced`**: Deep structural evolution of the concept (e.g., `Generators` $\rightarrow$ `Coroutines`).
- **`alternative`**: Competing patterns or syntaxes (e.g., `List comprehensions` vs `map()`).
- **`confused_with`**: Concepts frequently conflated by learners (e.g., `map()` vs `filter()`, `Iterables` vs `Iterators`).

> [!IMPORTANT]
> **Anti-Co-occurrence Guard**: Relationships are never established simply because two words co-occur on the same page. Every relationship is validated against semantic rules or curated taxonomy.

### 2.2 4-Tier Explicit Knowledge Status
Learners control their comprehension status across 4 distinct levels:
1. **`not_reviewed`**: Newly encountered or saved concept; in the user's learning inbox.
2. **`learning`**: Actively being studied and practiced.
3. **`understood`**: Explicitly confirmed as understood and mastered by the user.
4. **`needs_revision`**: Explicitly flagged by the user as requiring additional review, examples, or practice.

> [!NOTE]
> **Non-Assumption of Mastery Principle**: Curio **never** assumes that opening, reading, or scrolling an explanation equates to mastery. Only explicit user feedback adjusts understanding ratings.

### 2.3 Adaptive Knowledge Gap Detection Engine
The gap detection engine continuously evaluates local learning patterns across four vectors:
1. **Repeated Requests for Explanations**: Concepts explored $\ge 3$ times without being marked as `understood`.
2. **Explicit User Revision Flags**: Concepts marked `needs_revision`.
3. **Structural Graph Gaps**: Saved or explored concepts whose declared prerequisites are missing from the user's vault or unmastered.
4. **Learning Goal Milestones**: Target milestone concepts remaining in active learning goals.

> [!TIP]
> **Privacy & Suggestion Framing**: Inferred gaps are always explicitly labeled with `isInferred: true` and presented as *"Inferred suggestions based on learning patterns, not confirmed weaknesses."*

### 2.4 Curated Next-Step Recommendations
Following every explanation (in the floating overlay and dashboard), Curio presents **3 to 4 focused next steps** to guide progression without cognitive overload:
- After explaining **Python iterables**:
  - *Learn Iterators* (`prerequisite`/progression)
  - *Understand Generators* (`advanced`)
  - *Explore Lazy evaluation* (`related`)
- Already-mastered prerequisites are dynamically omitted to prioritize new learning horizons.

### 2.5 Personalized Learning Dashboard
Integrated into Curio's options interface (`src/options/LearningHub.jsx`):
- **Overview Metrics**: Live counts of Total Explored, Understood, Currently Learning, and Needs Revision.
- **Knowledge Gap Detection Center**: Real-time cards displaying inferred gaps with one-click study actions.
- **Active Learning Goals**: Progress percentage bars, milestone checklists, and presets (Python, React, Async JS, Distributed Systems).
- **Semantic Learning Paths**: Concept clusters organized by domain.
- **Recently Explored & Frequently Revisited**: Direct access to high-frequency study items.

### 2.6 AI Orchestration with Gemini & Groq
- Reuses the existing `GeminiProvider` and `GroqProvider` infrastructure.
- Endpoint `POST /api/v1/learning/analyze-concept` requests structured JSON analysis containing domain categorization, technical relationships, and recommendations.
- **Validation Pipeline**: Every relationship returned by an AI provider is validated via `validateRelationship()` to eliminate self-loops, empty terms, or invalid relationship enums before persistence.
- **Offline Fallback**: Seamless fallback to local static knowledge graph rules if the AI provider is unavailable.

### 2.7 Lightweight Local Concept Graph
- **Zero-Dependency Interactive Graph**: Rendered via pure React JSX and SVG.
- **Nodes**: Concepts colored by understanding status (Emerald = Understood, Amber = Learning, Rose = Needs Revision, Zinc = Not Reviewed).
- **Edges**: Directed arrows labeled by relationship type (`prerequisite`, `related`, `advanced`, `alternative`, `confused_with`).
- **User Control**: Users can manually add, edit, or delete relationship edges.

---

## 3. Privacy Guarantees & User Sovereignty

1. **Local-First Persistence**: Graph edges and learning goals are stored entirely in `chrome.storage.local` under `curio_graph_edges_v1` and `curio_learning_goals_v1`.
2. **Zero Full-History Tracking**: Curio never captures full browsing history or logs unhighlighted webpage content.
3. **Full Erasure & Exportability**: Users can export their entire learning graph and goals via JSON or wipe all learning data in one click.
