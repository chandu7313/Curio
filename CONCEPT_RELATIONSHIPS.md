# Curio — Concept Relationships & Knowledge Graph Mapping

## 1. Relationship Taxonomy & Formal Semantics

Curio structures conceptual knowledge through five standardized relationship types. Each type represents a distinct learning and architectural connection:

| Relationship Type | Formal Definition | User Mental Model | Example |
|---|---|---|---|
| **`prerequisite`** | Concept $A$ must be conceptually understood before Concept $B$ can be effectively grasped. | *"Learn this first"* | `Iterables` $\rightarrow$ `Iterators` |
| **`related`** | Concepts that operate together in idiomatic practice or share architectural paradigms. | *"Commonly used with"* | `yield statement` $\leftrightarrow$ `Generators` |
| **`advanced`** | Concept $B$ represents a deeper structural evolution, internal mechanic, or advanced progression of Concept $A$. | *"Deep dive next"* | `Generators` $\rightarrow$ `Coroutines` |
| **`alternative`** | Competing architectural patterns, idioms, or syntax achieving similar goals with different tradeoffs. | *"Alternative approach"* | `List comprehensions` vs `map()` |
| **`confused_with`** | Concepts frequently conflated due to superficial similarities, naming, or overlapping usage. | *"Frequently confused"* | `map()` vs `filter()` |

---

## 2. Core Technical Mappings

### 2.1 Python Iteration & Functional Progression

The canonical sequence demonstrating progressive mastery of Python memory and data streams:

```
[Iterables] ──(prerequisite)──> [Iterators] ──(prerequisite)──> [Generators] ──(related)──> [Lazy Evaluation]
     │                               │                               │
 (confused_with)                 (confused_with)                 (alternative)
     │                               │                               │
[Iterators]                     [Iterables]                 [List Comprehensions]
```

- **`Iterables`**:
  - `advanced` $\rightarrow$ `Iterators` (*Object capable of yielding elements via __iter__*)
  - `advanced` $\rightarrow$ `Generators` (*Lazy generator function sequences*)
  - `related` $\rightarrow$ `Lazy evaluation` (*Deferred computation*)
  - `confused_with` $\rightarrow$ `Iterators` (*Iterables can produce iterators; iterators maintain traversal state*)
- **`Iterators`**:
  - `prerequisite` $\rightarrow$ `Iterables` (*Must understand collections before stateful traversal*)
  - `advanced` $\rightarrow$ `Generators` (*Generators are syntactic sugar for stateful iterators*)
  - `related` $\rightarrow$ `next() & StopIteration` (*Low-level protocol primitives*)
- **`Generators`**:
  - `prerequisite` $\rightarrow$ `Iterators` (*Generators implement the iterator protocol*)
  - `related` $\rightarrow$ `yield statement` (*Suspends execution and yields control*)
  - `advanced` $\rightarrow$ `Coroutines` (*Bi-directional communication via send()*)
  - `alternative` $\rightarrow$ `Generator expressions` (*Inline syntax*)
- **`Map` & `Filter`**:
  - `map()` $\leftrightarrow$ `filter()`: `confused_with` (*map transforms 1:1; filter selects subset matching predicate*)
  - `prerequisite` $\rightarrow$ `Iterables`
  - `alternative` $\rightarrow$ `List comprehensions`
- **`Decorators`**:
  - `prerequisite` $\rightarrow$ `Closures` (*Inner wrapper functions retaining enclosing state*)
  - `prerequisite` $\rightarrow$ `Higher-order functions` (*Functions accepting/returning functions*)
  - `related` $\rightarrow$ `functools.wraps` (*Preserving function metadata*)
  - `advanced` $\rightarrow$ `Class decorators`

---

### 2.2 React Performance & Lifecycle Connections

```
[Referential Equality] ──(prerequisite)──> [useMemo] ──(alternative)──> [useCallback]
                                                │
                                          (subconcept)
                                                │
                                      [Fiber Reconciliation]
```

- **`useMemo`**:
  - `prerequisite` $\rightarrow$ `Referential equality` (*Prevents re-calculating identical dependencies*)
  - `related` $\rightarrow$ `useCallback` (*Function memoization sibling*)
  - `related` $\rightarrow$ `React.memo` (*Component-level render skipping*)
  - `advanced` $\rightarrow$ `Fiber reconciliation` (*React internal work scheduler*)
- **`useCallback`**:
  - `alternative` $\rightarrow$ `useMemo` (*useMemo(() => fn, deps) syntactic sugar*)
  - `prerequisite` $\rightarrow$ `Closures` (*Capturing lexical dependencies safely*)

---

### 2.3 JavaScript Runtime & Concurrency Connections

```
[Event Loop] ──(prerequisite)──> [Promises] ──(prerequisite)──> [async / await]
     │                               │
(subconcept)                   (alternative)
     │                               │
[Microtask Queue]               [Callbacks]
```

- **`async / await`**:
  - `prerequisite` $\rightarrow$ `Promises` (*Syntactic sugar over Promise resolution*)
  - `prerequisite` $\rightarrow$ `Event loop` (*V8 non-blocking event engine*)
  - `advanced` $\rightarrow$ `Microtask queue` (*Priority queue execution*)
  - `alternative` $\rightarrow$ `Callbacks` (*Legacy asynchronous pattern*)

---

### 2.4 Distributed Systems & Architecture

```
[Distributed Consensus] ──(prerequisite)──> [CAP Theorem] ──(alternative)──> [PACELC Theorem]
                                                  │
                                            (subconcept)
                                                  │
                                        [Partition Tolerance]
```

- **`CAP Theorem`**:
  - `prerequisite` $\rightarrow$ `Distributed consensus` (*Coordination primitives*)
  - `related` $\rightarrow$ `Eventual consistency` (*AP database architecture*)
  - `advanced` $\rightarrow$ `Partition tolerance` (*Network partition reality*)
  - `alternative` $\rightarrow$ `PACELC theorem` (*Latency vs consistency tradeoffs*)
- **`Idempotency`**:
  - `prerequisite` $\rightarrow$ `Retry mechanisms` (*Safe re-execution over networks*)
  - `related` $\rightarrow$ `HTTP PUT / DELETE` (*Idempotent REST specifications*)
  - `related` $\rightarrow$ `Message queues` (*At-least-once delivery handling*)

---

## 3. Relationship Validation & Anti-Hallucination Engine

Curio enforces strict validation before any relationship (curated, AI-generated, or user-defined) enters the graph:

```javascript
export function validateRelationship(sourceTerm, targetTerm, relation, label) {
  // Rule 1: No empty concepts
  if (!sourceTerm?.trim() || !targetTerm?.trim()) {
    return { valid: false, error: 'Source and target terms must be non-empty' };
  }

  // Rule 2: No self-referential connections
  if (normalizeKey(sourceTerm) === normalizeKey(targetTerm)) {
    return { valid: false, error: 'Self-referential relationships are not permitted' };
  }

  // Rule 3: Enforce valid relationship enum
  const rel = normalizeRelationType(relation);
  if (!VALID_RELATIONSHIPS.includes(rel)) {
    return { valid: false, error: `Invalid relationship type: ${relation}` };
  }

  return { valid: true };
}
```

### Anti-Co-occurrence Guard:
AI providers are explicitly instructed:
> *"Do NOT connect concepts simply because two words co-occur on a page. Only identify true conceptual relationships based on computer science, software engineering, or mathematical foundations."*
