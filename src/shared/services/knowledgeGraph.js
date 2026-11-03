/**
 * Curio — Knowledge Connections & Semantic Relationship Engine
 *
 * Establishes meaningful semantic relationships between technical concepts,
 * programming languages, system architectures, and mathematical constructs.
 *
 * Relationship types:
 *  - prerequisite: Concept A must be understood before Concept B
 *  - used_with: Concepts commonly combined in idiomatic practice
 *  - alternative: Competing or alternative patterns/libraries
 *  - subconcept: Concept B is a constituent component of Concept A
 *  - paradigm: Higher-level architectural or programming paradigm
 *
 * @module services/knowledgeGraph
 */

/**
 * @typedef {Object} ConceptRelation
 * @property {string} term - The related concept name
 * @property {'prerequisite'|'used_with'|'alternative'|'subconcept'|'paradigm'} relation - The relationship type
 * @property {string} label - Short readable relationship description
 */

/**
 * Curated knowledge graph database for technical topics.
 * Keys are normalized lower-case search strings.
 */
const KNOWLEDGE_GRAPH = {
  // Python ecosystem
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

  // JavaScript & React
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
function normalizeKey(text) {
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
 * @returns {ConceptRelation[]} Array of connected concepts
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
 * @returns {ConceptRelation[]}
 */
function generateDynamicRelations(term, category) {
  const lower = term.toLowerCase();

  if (lower.includes('hook') || lower.includes('state') || lower.includes('effect')) {
    return [
      { term: 'Component lifecycle', relation: 'prerequisite', label: 'Re-render triggers' },
      { term: 'Immutability', relation: 'used_with', label: 'State update rule' },
      { term: 'Fiber tree', relation: 'subconcept', label: 'React internal graph' },
    ];
  }

  if (lower.includes('api') || lower.includes('http') || lower.includes('rest')) {
    return [
      { term: 'HTTP status codes', relation: 'prerequisite', label: 'Standard response protocol' },
      { term: 'Idempotency', relation: 'used_with', label: 'Safe network retries' },
      { term: 'GraphQL', relation: 'alternative', label: 'Declarative query alternative' },
    ];
  }

  if (lower.includes('sort') || lower.includes('search') || lower.includes('tree') || lower.includes('graph')) {
    return [
      { term: 'Big-O notation', relation: 'prerequisite', label: 'Complexity evaluation' },
      { term: 'Recursion', relation: 'used_with', label: 'Traversal mechanics' },
      { term: 'Memory overhead', relation: 'subconcept', label: 'Stack vs heap trade-off' },
    ];
  }

  // Universal fallback relations for general technical terms
  return [
    { term: 'Architecture trade-offs', relation: 'paradigm', label: 'Design considerations' },
    { term: 'Best practices', relation: 'used_with', label: 'Industry conventions' },
    { term: 'Edge cases', relation: 'subconcept', label: 'Reliability bounds' },
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

  if (lang === 'python' || lower.includes('python') || lower.includes('django') || lower.includes('flask')) {
    return 'Python';
  }
  if (lower.startsWith('use') || lower.includes('react') || lower.includes('jsx')) {
    return 'React';
  }
  if (lang === 'javascript' || lang === 'typescript' || lower.includes('js') || lower.includes('node') || lower.includes('closure') || lower.includes('promise')) {
    return 'JavaScript';
  }
  if (lower.includes('microservice') || lower.includes('cap') || lower.includes('distributed') || lower.includes('cache') || lower.includes('concurrency')) {
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
