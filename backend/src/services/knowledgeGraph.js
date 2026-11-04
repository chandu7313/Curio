/**
 * Curio — Adaptive Learning Intelligence & Knowledge Connections Engine
 *
 * Establishes meaningful semantic relationships between technical concepts,
 * programming languages, system architectures, and mathematical constructs.
 *
 * Core Relationship Types:
 *  - prerequisite: Concept A must be understood before Concept B
 *  - related: Concepts that are complementary or frequently used together
 *  - advanced: Natural advanced progression or deeper underlying construct
 *  - alternative: Competing or alternative approaches/patterns
 *  - confused_with: Frequently confused or conflated concepts
 *
 * Legacy Aliases (Supported for backwards compatibility):
 *  - used_with -> mapped to 'related'
 *  - subconcept -> mapped to 'advanced'
 *  - paradigm -> mapped to 'related'
 *
 * @module services/knowledgeGraph
 */

export const VALID_RELATIONSHIPS = [
  'prerequisite',
  'related',
  'advanced',
  'alternative',
  'confused_with',
  'used_with',
  'subconcept',
  'paradigm',
];

/**
 * Normalize relationship types to canonical set.
 * @param {string} rel
 * @returns {'prerequisite'|'related'|'advanced'|'alternative'|'confused_with'}
 */
export function normalizeRelationType(rel) {
  const lower = (rel || '').toLowerCase().trim();
  switch (lower) {
    case 'used_with':
    case 'paradigm':
      return 'related';
    case 'subconcept':
      return 'advanced';
    case 'prerequisite':
    case 'related':
    case 'advanced':
    case 'alternative':
    case 'confused_with':
      return lower;
    default:
      return 'related';
  }
}

/**
 * Curated knowledge graph database for technical topics.
 * Keys are normalized lower-case search strings.
 */
export const KNOWLEDGE_GRAPH = {
  // Python ecosystem — Iterables, Iterators, Generators, Functional
  'iterable': [
    { term: 'Iterators', relation: 'advanced', label: 'Object that produces elements via __next__' },
    { term: 'Generators', relation: 'advanced', label: 'Functions that yield lazy iterable sequences' },
    { term: 'Lazy evaluation', relation: 'related', label: 'Deferred computation pattern' },
    { term: 'for loops', relation: 'related', label: 'Core imperative iteration mechanism' },
    { term: 'Iterators', relation: 'confused_with', label: 'Iterables produce iterators; iterators maintain state' },
  ],
  'iterables': [
    { term: 'Iterators', relation: 'advanced', label: 'Object that produces elements via __next__' },
    { term: 'Generators', relation: 'advanced', label: 'Functions that yield lazy iterable sequences' },
    { term: 'Lazy evaluation', relation: 'related', label: 'Deferred computation pattern' },
    { term: 'for loops', relation: 'related', label: 'Core imperative iteration mechanism' },
    { term: 'Iterators', relation: 'confused_with', label: 'Iterables produce iterators; iterators maintain state' },
  ],
  'python iterable': [
    { term: 'Iterators', relation: 'advanced', label: 'Object that produces elements via __next__' },
    { term: 'Generators', relation: 'advanced', label: 'Functions that yield lazy iterable sequences' },
    { term: 'Lazy evaluation', relation: 'related', label: 'Deferred computation pattern' },
    { term: 'for loops', relation: 'related', label: 'Core imperative iteration mechanism' },
  ],
  'python iterables': [
    { term: 'Iterators', relation: 'advanced', label: 'Object that produces elements via __next__' },
    { term: 'Generators', relation: 'advanced', label: 'Functions that yield lazy iterable sequences' },
    { term: 'Lazy evaluation', relation: 'related', label: 'Deferred computation pattern' },
    { term: 'for loops', relation: 'related', label: 'Core imperative iteration mechanism' },
  ],
  'iterator': [
    { term: 'Iterables', relation: 'prerequisite', label: 'Must understand collection before stateful traversal' },
    { term: 'Generators', relation: 'advanced', label: 'Syntactic sugar for writing iterators easily' },
    { term: 'next() & StopIteration', relation: 'related', label: 'Low-level iteration protocol primitives' },
    { term: 'Iterables', relation: 'confused_with', label: 'Iterables can be re-iterated; iterators are exhausted' },
  ],
  'iterators': [
    { term: 'Iterables', relation: 'prerequisite', label: 'Must understand collection before stateful traversal' },
    { term: 'Generators', relation: 'advanced', label: 'Syntactic sugar for writing iterators easily' },
    { term: 'next() & StopIteration', relation: 'related', label: 'Low-level iteration protocol primitives' },
    { term: 'Iterables', relation: 'confused_with', label: 'Iterables can be re-iterated; iterators are exhausted' },
  ],
  'generator': [
    { term: 'Iterators', relation: 'prerequisite', label: 'Generators are a special type of iterator' },
    { term: 'yield statement', relation: 'related', label: 'Pauses function execution and returns value' },
    { term: 'Lazy evaluation', relation: 'related', label: 'Memory-efficient on-demand streaming' },
    { term: 'Generator expressions', relation: 'alternative', label: 'Inline comprehension-like generator syntax' },
    { term: 'Coroutines', relation: 'advanced', label: 'Bi-directional generator communication' },
  ],
  'generators': [
    { term: 'Iterators', relation: 'prerequisite', label: 'Generators are a special type of iterator' },
    { term: 'yield statement', relation: 'related', label: 'Pauses function execution and returns value' },
    { term: 'Lazy evaluation', relation: 'related', label: 'Memory-efficient on-demand streaming' },
    { term: 'Generator expressions', relation: 'alternative', label: 'Inline comprehension-like generator syntax' },
    { term: 'Coroutines', relation: 'advanced', label: 'Bi-directional generator communication' },
  ],
  'lazy evaluation': [
    { term: 'Iterators', relation: 'prerequisite', label: 'Stateful protocol powering lazy streams' },
    { term: 'Generators', relation: 'related', label: 'Primary Python implementation of laziness' },
    { term: 'Memory optimization', relation: 'related', label: 'Avoids allocating massive arrays in RAM' },
    { term: 'Eager evaluation', relation: 'alternative', label: 'Immediate computation of entire result' },
  ],
  'map': [
    { term: 'Iterables', relation: 'prerequisite', label: 'Operates over iterables' },
    { term: 'Lambda functions', relation: 'used_with', label: 'Frequently paired with lambdas' },
    { term: 'List comprehensions', relation: 'alternative', label: 'Pythonic alternative' },
    { term: 'Functional programming', relation: 'paradigm', label: 'Foundational paradigm' },
  ],
  'python map': [
    { term: 'Iterables', relation: 'prerequisite', label: 'Operates over iterables' },
    { term: 'Lambda functions', relation: 'used_with', label: 'Frequently paired with lambdas' },
    { term: 'List comprehensions', relation: 'alternative', label: 'Pythonic alternative' },
    { term: 'Functional programming', relation: 'paradigm', label: 'Foundational paradigm' },
  ],
  'filter': [
    { term: 'Iterables', relation: 'prerequisite', label: 'Filters elements from an iterable collection' },
    { term: 'Lambda functions', relation: 'related', label: 'Predicate functions passed to filter' },
    { term: 'List comprehensions', relation: 'alternative', label: '[x for x in list if cond] alternative' },
    { term: 'Python map', relation: 'confused_with', label: 'map transforms each item; filter selects subset' },
  ],
  'list comprehension': [
    { term: 'Generator expressions', relation: 'alternative', label: 'Memory-efficient lazy streaming' },
    { term: 'for loops', relation: 'prerequisite', label: 'Imperative foundation' },
    { term: 'Python map()', relation: 'alternative', label: 'Functional counterpart' },
  ],
  'lambda': [
    { term: 'Anonymous functions', relation: 'subconcept', label: 'Theoretical basis' },
    { term: 'Higher-order functions', relation: 'used_with', label: 'Primary use context' },
    { term: 'Closures', relation: 'used_with', label: 'Captures enclosing state' },
  ],
  'lambda functions': [
    { term: 'Higher-order functions', relation: 'prerequisite', label: 'Functions passed into or returned from functions' },
    { term: 'Python map()', relation: 'related', label: 'Common transformation consumer' },
    { term: 'def functions', relation: 'alternative', label: 'Standard named multiline functions' },
    { term: 'Closures', relation: 'related', label: 'Capturing enclosing lexical scope' },
  ],
  'decorator': [
    { term: 'Closures', relation: 'prerequisite', label: 'Inner wrapper functions capturing outer scope' },
    { term: 'Higher-order functions', relation: 'prerequisite', label: 'Functions taking and returning functions' },
    { term: 'functools.wraps', relation: 'related', label: 'Preserves docstrings and metadata' },
    { term: 'Class decorators', relation: 'advanced', label: 'Decorating class constructors and methods' },
    { term: 'Monkey patching', relation: 'alternative', label: 'Brittle runtime attribute replacement' },
  ],
  'decorators': [
    { term: 'Closures', relation: 'prerequisite', label: 'Inner wrapper functions capturing outer scope' },
    { term: 'Higher-order functions', relation: 'prerequisite', label: 'Functions taking and returning functions' },
    { term: 'functools.wraps', relation: 'related', label: 'Preserves docstrings and metadata' },
    { term: 'Class decorators', relation: 'advanced', label: 'Decorating class constructors and methods' },
    { term: 'Monkey patching', relation: 'alternative', label: 'Brittle runtime attribute replacement' },
  ],

  // JavaScript & React Ecosystem
  'memoization': [
    { term: 'Pure functions', relation: 'prerequisite', label: 'Required for safe caching' },
    { term: 'Cache invalidation', relation: 'used_with', label: 'Critical lifecycle concern' },
    { term: 'Space-time tradeoff', relation: 'paradigm', label: 'Algorithmic principle' },
    { term: 'React useMemo', relation: 'subconcept', label: 'React implementation' },
  ],
  'usememo': [
    { term: 'Referential equality', relation: 'prerequisite', label: 'Prevents unnecessary re-renders' },
    { term: 'useCallback', relation: 'used_with', label: 'Function memoization sibling' },
    { term: 'React.memo', relation: 'used_with', label: 'Component-level memoization' },
    { term: 'Fiber reconciliation', relation: 'subconcept', label: 'Underlying React mechanism' },
  ],
  'usecallback': [
    { term: 'useMemo', relation: 'alternative', label: 'useMemo(() => fn, deps) sugar' },
    { term: 'Closures', relation: 'prerequisite', label: 'Captures lexical dependencies' },
    { term: 'React.memo', relation: 'used_with', label: 'Optimizes child component renders' },
  ],
  'closure': [
    { term: 'Lexical scoping', relation: 'prerequisite', label: 'Determines variable availability' },
    { term: 'Heap allocation', relation: 'subconcept', label: 'Engine memory behavior' },
    { term: 'Higher-order functions', relation: 'used_with', label: 'Factory & wrapper patterns' },
    { term: 'Garbage collection', relation: 'subconcept', label: 'Retained memory implications' },
  ],
  'async await': [
    { term: 'Promises', relation: 'prerequisite', label: 'Underlying primitive' },
    { term: 'Event loop', relation: 'prerequisite', label: 'Async execution engine' },
    { term: 'Microtask queue', relation: 'subconcept', label: 'V8 priority queue' },
    { term: 'Promise.all', relation: 'used_with', label: 'Concurrent resolution' },
  ],
  'promise': [
    { term: 'Event loop', relation: 'prerequisite', label: 'Runtime task runner' },
    { term: 'Callbacks', relation: 'alternative', label: 'Legacy asynchronous pattern' },
    { term: 'async await', relation: 'used_with', label: 'Modern synchronous-like syntax' },
  ],
  'shadow dom': [
    { term: 'Web components', relation: 'paradigm', label: 'Component architecture' },
    { term: 'AdoptedStyleSheets', relation: 'used_with', label: 'Shared styling construct' },
    { term: 'Event retargeting', relation: 'subconcept', label: 'Cross-boundary event security' },
    { term: 'Custom elements', relation: 'used_with', label: 'DOM tag encapsulation' },
  ],
  'content security policy': [
    { term: 'XSS prevention', relation: 'paradigm', label: 'Primary security purpose' },
    { term: 'CORS', relation: 'used_with', label: 'Resource access restrictions' },
    { term: 'script-src', relation: 'subconcept', label: 'Key execution directive' },
    { term: 'Nonce / Hash', relation: 'used_with', label: 'Inline script verification' },
  ],
  'csp': [
    { term: 'XSS prevention', relation: 'paradigm', label: 'Primary security purpose' },
    { term: 'CORS', relation: 'used_with', label: 'Resource access restrictions' },
    { term: 'script-src', relation: 'subconcept', label: 'Key execution directive' },
  ],

  // Distributed Systems & Architecture
  'cap theorem': [
    { term: 'Distributed consensus', relation: 'prerequisite', label: 'Network coordination' },
    { term: 'PACELC theorem', relation: 'alternative', label: 'Extended latency tradeoff' },
    { term: 'Eventual consistency', relation: 'used_with', label: 'AP database model' },
    { term: 'Partition tolerance', relation: 'subconcept', label: 'Non-negotiable on networks' },
  ],
  'idempotency': [
    { term: 'HTTP PUT/DELETE', relation: 'used_with', label: 'REST protocol guarantees' },
    { term: 'Retry mechanisms', relation: 'prerequisite', label: 'Safe network re-transmission' },
    { term: 'Message queues', relation: 'used_with', label: 'At-least-once delivery handling' },
  ],
};

/**
 * Normalize search strings for knowledge graph indexing.
 * @param {string} text
 * @returns {string}
 */
export function normalizeKey(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Retrieve meaningful connected concepts for a given selection or concept term.
 *
 * @param {string} conceptTerm - Selected text or extracted topic
 * @param {string} [contextCategory] - Broad category hint
 * @returns {Array<{ term: string, relation: string, label: string }>} Array of connected concepts
 */
export function getRelatedConcepts(conceptTerm, contextCategory = '') {
  if (!conceptTerm) return [];

  const rawKey = normalizeKey(conceptTerm);

  // Exact match
  if (KNOWLEDGE_GRAPH[rawKey]) {
    return KNOWLEDGE_GRAPH[rawKey];
  }

  // Partial match: Check if any known key is contained in or contains the search term
  for (const [key, relations] of Object.entries(KNOWLEDGE_GRAPH)) {
    if (rawKey.includes(key) || key.includes(rawKey)) {
      return relations;
    }
  }

  // Domain-based heuristic fallback if term isn't in static dictionary
  return generateDynamicRelations(conceptTerm, contextCategory);
}

/**
 * Dynamic relationship inferrer based on common patterns.
 * @param {string} term
 * @param {string} category
 * @returns {Array<{ term: string, relation: string, label: string }>}
 */
function generateDynamicRelations(term, category) {
  const lower = term.toLowerCase();

  if (lower.includes('hook') || lower.includes('state') || lower.includes('effect')) {
    return [
      { term: 'Component lifecycle', relation: 'prerequisite', label: 'Re-render triggers' },
      { term: 'Immutability', relation: 'related', label: 'State update rule' },
      { term: 'Fiber tree', relation: 'advanced', label: 'React internal graph' },
    ];
  }

  if (lower.includes('api') || lower.includes('http') || lower.includes('rest')) {
    return [
      { term: 'HTTP status codes', relation: 'prerequisite', label: 'Standard response protocol' },
      { term: 'Idempotency', relation: 'related', label: 'Safe network retries' },
      { term: 'GraphQL', relation: 'alternative', label: 'Declarative query alternative' },
    ];
  }

  if (lower.includes('sort') || lower.includes('search') || lower.includes('tree') || lower.includes('graph')) {
    return [
      { term: 'Big-O notation', relation: 'prerequisite', label: 'Complexity evaluation' },
      { term: 'Recursion', relation: 'related', label: 'Traversal mechanics' },
      { term: 'Memory overhead', relation: 'advanced', label: 'Stack vs heap trade-off' },
    ];
  }

  // Universal fallback relations for general technical terms
  return [
    { term: 'Architecture trade-offs', relation: 'related', label: 'Design considerations' },
    { term: 'Best practices', relation: 'related', label: 'Industry conventions' },
    { term: 'Edge cases', relation: 'advanced', label: 'Reliability bounds' },
  ];
}

/**
 * Categorize a concept into a broad domain automatically.
 *
 * @param {string} term
 * @param {string} [language]
 * @returns {string} One of: 'React', 'Python', 'JavaScript', 'Architecture', 'Algorithms', 'Security', 'Web Standards', 'General'
 */
export function inferConceptCategory(term, language) {
  const lower = (term || '').toLowerCase();
  const lang = (language || '').toLowerCase();

  if (lang === 'python' || lower.includes('python') || lower.includes('django') || lower.includes('flask') || lower.includes('iterable') || lower.includes('yield') || lower.includes('lambda')) {
    return 'Python';
  }
  if (lower.startsWith('use') || lower.includes('react') || lower.includes('jsx')) {
    return 'React';
  }
  if (lang === 'javascript' || lang === 'typescript' || lower.includes('js') || lower.includes('node') || lower.includes('closure') || lower.includes('promise')) {
    return 'JavaScript';
  }
  if (lower.includes('microservice') || lower.includes('cap') || lower.includes('distributed') || lower.includes('cache') || lower.includes('concurrency') || lower.includes('idempotenc') || lower.includes('consensus')) {
    return 'Architecture';
  }
  if (lower.includes('sort') || lower.includes('search') || lower.includes('tree') || lower.includes('graph') || lower.includes('big-o') || lower.includes('complexity')) {
    return 'Algorithms';
  }
  if (
    lower.includes('auth') ||
    lower.includes('jwt') ||
    lower.includes('csp') ||
    lower.includes('xss') ||
    lower.includes('csrf') ||
    lower.includes('cipher') ||
    lower.includes('security') ||
    lower.includes('nonce') ||
    lower.includes('sanitize')
  ) {
    return 'Security';
  }
  if (lower.includes('dom') || lower.includes('css') || lower.includes('html') || lower.includes('web component')) {
    return 'Web Standards';
  }

  return 'General';
}

/**
 * Validate a concept relationship before adding it to the graph.
 * Enforces semantic validity, rejects self-loops and empty inputs.
 *
 * @param {string} sourceTerm
 * @param {string} targetTerm
 * @param {string} relation
 * @param {string} [label]
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateRelationship(sourceTerm, targetTerm, relation, label = '') {
  if (!sourceTerm || typeof sourceTerm !== 'string' || !sourceTerm.trim()) {
    return { valid: false, error: 'Source term cannot be empty' };
  }
  if (!targetTerm || typeof targetTerm !== 'string' || !targetTerm.trim()) {
    return { valid: false, error: 'Target term cannot be empty' };
  }

  const s = normalizeKey(sourceTerm);
  const t = normalizeKey(targetTerm);

  if (s === t) {
    return { valid: false, error: 'Self-referential relationships are not permitted' };
  }

  const relLower = (relation || '').toLowerCase().trim();
  if (!VALID_RELATIONSHIPS.includes(relLower)) {
    return {
      valid: false,
      error: `Invalid relationship type "${relation}". Allowed: prerequisite, related, advanced, alternative, confused_with.`,
    };
  }

  return { valid: true };
}

/**
 * Generate 3-4 curated recommendations for next steps after exploring a concept.
 * Avoids overwhelming the user with excessive recommendations.
 *
 * @param {string} conceptTerm
 * @param {Array<Object>} [userConcepts=[]] - User's existing saved concepts
 * @returns {Array<{ term: string, action: string, reason: string, relation: string }>}
 */
export function getCuratedRecommendations(conceptTerm, userConcepts = []) {
  if (!conceptTerm) return [];
  const related = getRelatedConcepts(conceptTerm);
  if (!related || related.length === 0) return [];

  const userTerms = new Set(
    userConcepts.map((c) => normalizeKey(c.selectedText || c.term || c.title || ''))
  );

  const recommendations = [];

  for (const rel of related) {
    if (recommendations.length >= 4) break;

    const normRelTerm = normalizeKey(rel.term);
    const alreadyUnderstood = userConcepts.some(
      (c) => normalizeKey(c.selectedText || c.term || '') === normRelTerm &&
             (c.understandingStatus === 'understood' || c.understandingLevel === 'understood')
    );

    // If user already mastered this prerequisite, skip to next progression
    if (alreadyUnderstood && rel.relation === 'prerequisite') {
      continue;
    }

    let action = `Explore ${rel.term}`;
    const relCanonical = normalizeRelationType(rel.relation);

    switch (relCanonical) {
      case 'prerequisite':
        action = `Learn ${rel.term} (Prerequisite)`;
        break;
      case 'advanced':
        action = `Understand ${rel.term}`;
        break;
      case 'alternative':
        action = `Compare with ${rel.term}`;
        break;
      case 'confused_with':
        action = `Clarify difference with ${rel.term}`;
        break;
      case 'related':
      default:
        action = `Explore ${rel.term}`;
        break;
    }

    recommendations.push({
      term: rel.term,
      action,
      reason: rel.label || `Connected via ${relCanonical} relationship`,
      relation: relCanonical,
      isSaved: userTerms.has(normRelTerm),
    });
  }

  return recommendations.slice(0, 4);
}

/**
 * Trace the prerequisite chain for a given concept term.
 *
 * @param {string} conceptTerm
 * @param {number} [maxDepth=5]
 * @returns {Array<{ term: string, label: string }>}
 */
export function getPrerequisiteChain(conceptTerm, maxDepth = 5) {
  const chain = [];
  const visited = new Set();
  let current = conceptTerm;

  while (current && chain.length < maxDepth) {
    const norm = normalizeKey(current);
    if (visited.has(norm)) break;
    visited.add(norm);

    const related = getRelatedConcepts(current);
    const prereq = related.find(
      (r) => normalizeRelationType(r.relation) === 'prerequisite'
    );

    if (prereq && !visited.has(normalizeKey(prereq.term))) {
      chain.push({ term: prereq.term, label: prereq.label });
      current = prereq.term;
    } else {
      break;
    }
  }

  return chain;
}

/**
 * Cluster user concepts into semantic groups (e.g. Python Iteration Protocol).
 *
 * @param {Array<Object>} concepts
 * @param {Array<Object>} [customEdges=[]]
 * @returns {Array<{ groupName: string, category: string, concepts: Array<Object> }>}
 */
export function groupRelatedConcepts(concepts = [], customEdges = []) {
  if (!concepts || concepts.length === 0) return [];

  const clusters = new Map();

  for (const concept of concepts) {
    const category = concept.category || 'General';
    if (!clusters.has(category)) {
      clusters.set(category, []);
    }
    clusters.get(category).push(concept);
  }

  const result = [];
  for (const [category, items] of clusters.entries()) {
    result.push({
      groupName: `${category} Learning Path`,
      category,
      concepts: items,
      totalCount: items.length,
      understoodCount: items.filter(
        (c) => c.understandingStatus === 'understood' || c.understandingLevel === 'understood'
      ).length,
    });
  }

  return result;
}
