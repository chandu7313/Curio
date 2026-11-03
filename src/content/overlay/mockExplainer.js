/**
 * Curio — Mock Explanation & Contextual Analysis Engine
 *
 * Provides realistic, content-aware mock explanations across three distinct
 * cognitive depths (Simple, Intermediate, Advanced) and handles simulated
 * follow-up interactions and local bookmarks persistence.
 *
 * (Note: Production AI streaming integration via Service Worker Ports
 * will be connected in Phase 2).
 *
 * @module overlay/mockExplainer
 */

/**
 * @typedef {'simple'|'intermediate'|'advanced'} ExplanationLevel
 */

/**
 * @typedef {Object} CodeSnippet
 * @property {string} language
 * @property {string} code
 * @property {string} [caption]
 */

/**
 * @typedef {Object} FormattedExplanation
 * @property {string} title
 * @property {string} summary
 * @property {string[]} keyPoints
 * @property {CodeSnippet|null} codeExample
 * @property {string|null} deepDive
 * @property {string} mode
 */

// ─── Bookmark Persistence ────────────────────────────────────────────

const BOOKMARKS_STORAGE_KEY = 'curio_bookmarks';

/**
 * Retrieve all saved bookmarks from chrome.storage.local.
 * @returns {Promise<Array<Object>>}
 */
export async function getSavedBookmarks() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const res = await chrome.storage.local.get([BOOKMARKS_STORAGE_KEY]);
      return res[BOOKMARKS_STORAGE_KEY] || [];
    }
  } catch (err) {
    console.warn('[Curio] Failed to load bookmarks:', err);
  }
  return [];
}

/**
 * Toggle bookmark state for a given selection context and explanation.
 *
 * @param {Object} item
 * @param {string} item.selectedText
 * @param {string} item.pageTitle
 * @param {string} item.pageUrl
 * @param {string} item.contentType
 * @param {FormattedExplanation} item.explanation
 * @returns {Promise<boolean>} Whether item is now bookmarked
 */
export async function toggleBookmark(item) {
  try {
    const list = await getSavedBookmarks();
    const existingIndex = list.findIndex(
      (b) => b.selectedText.trim() === item.selectedText.trim() && b.pageUrl === item.pageUrl
    );

    let isSaved = false;
    let updated = [];

    if (existingIndex >= 0) {
      // Remove
      updated = list.filter((_, i) => i !== existingIndex);
      isSaved = false;
    } else {
      // Add
      const newBookmark = {
        id: `bm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        selectedText: item.selectedText,
        pageTitle: item.pageTitle || '',
        pageUrl: item.pageUrl || '',
        contentType: item.contentType || 'prose',
        mode: item.explanation.mode,
        title: item.explanation.title,
        summary: item.explanation.summary,
        savedAt: Date.now(),
      };
      updated = [newBookmark, ...list];
      isSaved = true;
    }

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [BOOKMARKS_STORAGE_KEY]: updated });
    }

    return isSaved;
  } catch (err) {
    console.warn('[Curio] Bookmark toggle failed:', err);
    return false;
  }
}

/**
 * Check if a snippet is already saved in bookmarks.
 * @param {string} text
 * @param {string} url
 * @returns {Promise<boolean>}
 */
export async function isItemBookmarked(text, url) {
  if (!text) return false;
  const list = await getSavedBookmarks();
  return list.some(
    (b) => b.selectedText.trim() === text.trim() && (!url || b.pageUrl === url)
  );
}

// ─── Realistic Explanation Generators ────────────────────────────────

/**
 * Analyze input text and generate a structured, context-tailored explanation.
 *
 * @param {Object} context
 * @param {string} context.selectedText
 * @param {'prose'|'code'|'math'|'input'} [context.contentType]
 * @param {string|null} [context.language]
 * @param {string} [context.sentence]
 * @param {string|null} [context.nearestHeading]
 * @param {ExplanationLevel} mode
 * @returns {FormattedExplanation}
 */
export function generateMockExplanation(context, mode = 'intermediate') {
  const { selectedText, contentType = 'prose', language, sentence, nearestHeading } = context;
  const cleanText = (selectedText || '').trim();
  const lower = cleanText.toLowerCase();

  // 1. Code / Programming Syntaxes
  if (contentType === 'code' || /^(const|let|var|function|import|export|class|def|async|await|return|\w+\(.*\)|<.*>)/.test(cleanText)) {
    return generateCodeExplanation(cleanText, language || 'javascript', mode, nearestHeading);
  }

  // 2. Mathematical expressions
  if (contentType === 'math' || /[∑∫√πθλ±≤≥≠≈∞\^_{}]/.test(cleanText) || cleanText.includes('\\')) {
    return generateMathExplanation(cleanText, mode);
  }

  // 3. Known technical terminology & concept patterns
  if (lower.includes('memoiz') || lower.includes('cache')) {
    return generateMemoizationExplanation(cleanText, mode);
  }
  if (lower.includes('closure') || lower.includes('scope')) {
    return generateClosureExplanation(cleanText, mode);
  }
  if (lower.includes('promise') || lower.includes('async') || lower.includes('await')) {
    return generateAsyncExplanation(cleanText, mode);
  }
  if (lower.includes('shadow dom') || lower.includes('web component')) {
    return generateShadowDomExplanation(cleanText, mode);
  }
  if (lower.includes('csp') || lower.includes('content security policy')) {
    return generateCspExplanation(cleanText, mode);
  }

  // 4. Default intelligent generic generator
  return generateGenericExplanation(cleanText, mode, sentence, nearestHeading);
}

// ─── Specific Concept Generators ──────────────────────────────────────

function generateCodeExplanation(code, language, mode, nearestHeading) {
  const langDisplay = language ? language.toUpperCase() : 'CODE';
  const snippet = code.length > 250 ? code.slice(0, 250) + '...' : code;

  if (mode === 'simple') {
    return {
      title: `${langDisplay} Snippet Explanation`,
      summary: `This is a command or instruction written in ${langDisplay}. It tells the computer to perform a specific action, handle data, or transform values step-by-step.`,
      keyPoints: [
        'Acts like a mini recipe for the computer to follow.',
        'Uses standard programming conventions to stay safe and readable.',
        'Prevents manual errors by automating the calculation or logic.',
      ],
      codeExample: {
        language,
        code: snippet,
        caption: 'Selected snippet',
      },
      deepDive: null,
      mode,
    };
  }

  if (mode === 'advanced') {
    return {
      title: `${langDisplay} Deep Implementation & Execution`,
      summary: `Evaluates as an expression or block in the runtime's engine. Memory is allocated on the stack or heap depending on escape analysis, with lexical scope capture and potential GC retention implications.`,
      keyPoints: [
        'Execution Context: Creates a lexical environment record upon invocation.',
        'Complexity: Execution order is deterministic with O(1) or O(n) algorithmic overhead depending on inner operations.',
        'Optimization: V8 or runtime JIT compilers may inline or optimize this block if monomorphic call sites are observed.',
      ],
      codeExample: {
        language,
        code: snippet,
        caption: 'Deconstructed snippet',
      },
      deepDive: 'Ensure closures inside loop constructs or long-lived event handlers avoid accidental memory leaks by referencing unneeded outer bindings.',
      mode,
    };
  }

  // Intermediate (default)
  return {
    title: `${langDisplay} Syntax & Logic Overview`,
    summary: `A structured ${langDisplay} construct${nearestHeading ? ` within the context of "${nearestHeading}"` : ''}. It defines executable logic, binds variables, or invokes an API interface to process data.`,
    keyPoints: [
      'Executes predictably within the surrounding module or function scope.',
      'Follows language idiom for error propagation and type handling.',
      'Can be composed with other routines for clean separation of concerns.',
    ],
    codeExample: {
      language,
      code: snippet,
      caption: 'Code reference',
    },
    deepDive: null,
    mode,
  };
}

function generateMemoizationExplanation(term, mode) {
  if (mode === 'simple') {
    return {
      title: 'Memoization (Smart Shortcut)',
      summary: 'Memoization is like writing down the answer to a tricky math problem on a sticky note. The next time someone asks you that exact same question, you just read the sticky note instead of doing all the math again!',
      keyPoints: [
        'Saves time by remembering past calculations.',
        'Only calculates fresh answers when the question actually changes.',
        'Makes apps feel snappier and run smoother.',
      ],
      codeExample: {
        language: 'javascript',
        code: `// Simple memoize pattern
const cache = {};
function expensive(n) {
  if (n in cache) return cache[n]; // Instant return!
  return (cache[n] = n * 2);
}`,
      },
      deepDive: null,
      mode,
    };
  }

  if (mode === 'advanced') {
    return {
      title: 'Memoization: Cache Invalidation & Memory Overhead',
      summary: 'A deterministic space-time tradeoff optimization that stores the output of pure function invocations keyed by serialized arguments or identity tuples. Memory consumption scales with cardinality of argument space.',
      keyPoints: [
        'Referential Transparency: Only valid for pure functions without observable side-effects.',
        'Cache Eviction: Unbounded Map objects trigger memory leaks; production implementations require LRU (Least Recently Used) or WeakMap keying.',
        'Cache Key Overhead: Complex argument serialization (e.g. JSON.stringify) can exceed the execution time of simple functions.',
      ],
      codeExample: {
        language: 'typescript',
        code: `const memoized = new WeakMap<object, Result>();
function getMetrics(entity: Entity): Result {
  if (!memoized.has(entity)) {
    memoized.set(entity, computeExpensive(entity));
  }
  return memoized.get(entity)!;
}`,
      },
      deepDive: 'In React, useMemo/useCallback maintain a single-slot cache tied to fiber reconciliation lifecycle rather than an unbounded key-value map.',
      mode,
    };
  }

  // Intermediate
  return {
    title: 'Memoization: Performance Optimization',
    summary: 'An optimization technique used primarily to speed up programs by storing the results of expensive function calls and returning the cached result when the exact same inputs occur again.',
    keyPoints: [
      'Trade-off: Uses additional memory to save computational CPU cycles.',
      'Common in UI libraries (React.memo, useMemo) to prevent redundant DOM re-renders.',
      'Requires function purity—functions with external side-effects should not be memoized.',
    ],
    codeExample: {
      language: 'javascript',
      code: `const memoizedAdd = useMemo(() => {
  return calculateHeavySum(items);
}, [items]); // Recomputes only when items change`,
    },
    deepDive: null,
    mode,
  };
}

function generateClosureExplanation(term, mode) {
  if (mode === 'simple') {
    return {
      title: 'Closure: A Backpack for Functions',
      summary: 'When a function is created, it packs a little backpack with all the variables that were sitting around it. Even if you send that function far away to run later, it can still reach into its backpack and use those variables!',
      keyPoints: [
        'Functions remember where they were born.',
        'Keeps data private and protected from the rest of the app.',
        'Allows customized helper functions.',
      ],
      codeExample: {
        language: 'javascript',
        code: `function makeGreeter(greeting) {
  return function(name) {
    return greeting + ', ' + name; // remembers greeting!
  };
}`,
      },
      deepDive: null,
      mode,
    };
  }

  if (mode === 'advanced') {
    return {
      title: 'Lexical Closures: Heap Retention & Scope Chains',
      summary: 'Formally, a closure is the combination of a function object and a reference to its outer lexical environment record (Environment_Record). Variables retained in the scope chain survive the stack frame lifecycle.',
      keyPoints: [
        'Heap Promotion: Captured stack variables escape to the heap to allow persistent outer reference.',
        'Memory Leaks: Retaining large outer objects via unused closure references prevents GC sweep.',
        'Optimization: Modern engines (V8, JavaScriptCore) perform dead-variable elimination on unreferenced outer identifiers.',
      ],
      codeExample: {
        language: 'javascript',
        code: `function createCounter() {
  let count = 0; // Heap-promoted
  return {
    inc: () => ++count,
    get: () => count
  };
}`,
      },
      deepDive: 'Watch for circular references in closures holding DOM element pointers, which can defer garbage collection in long-lived SPAs.',
      mode,
    };
  }

  // Intermediate
  return {
    title: 'Closure: Lexical Scoping in JavaScript',
    summary: 'A feature where an inner function retains access to variables from an outer (enclosing) function’s scope, even after the outer function has finished executing.',
    keyPoints: [
      'Enables data encapsulation and private state.',
      'Fundamental to event handlers, callbacks, and factory functions.',
      'The inner function maintains a persistent link to its lexical parent.',
    ],
    codeExample: {
      language: 'javascript',
      code: `function setupTimer(label) {
  return () => console.log('Timer finished for:', label);
}`,
    },
    deepDive: null,
    mode,
  };
}

function generateAsyncExplanation(term, mode) {
  if (mode === 'simple') {
    return {
      title: 'Async & Await: Waiting Without Freezing',
      summary: 'Imagine ordering food at a counter and taking a buzzer. Instead of freezing in place until the food is cooked, you can sit down and check your phone. When the buzzer rings (the Promise resolves), you collect your meal!',
      keyPoints: [
        'Keeps websites responsive while loading data from the internet.',
        'Prevents your browser screen from locking up.',
        '"Await" simply means "pause here until this specific data arrives".',
      ],
      codeExample: {
        language: 'javascript',
        code: `async function loadProfile() {
  const data = await fetchUser(); // Buzzer waits here
  showProfile(data);
}`,
      },
      deepDive: null,
      mode,
    };
  }

  if (mode === 'advanced') {
    return {
      title: 'Async/Await: Microtask Queue & Coroutine Mechanics',
      summary: 'Syntactic sugar built upon generator coroutines and ES Promises. An `await` expression suspends execution of the async function generator, scheduling the resumption as a reaction job on the microtask queue (v8 MicrotaskQueue).',
      keyPoints: [
        'Event Loop Priority: Microtasks execute before macrotasks (setTimeout, I/O) and render ticks.',
        'Error Handling: Unhandled rejections trigger unhandledrejection lifecycle events.',
        'Concurrency Hazards: Sequential `await` in loops produces waterfall latency; use `Promise.all` or `Promise.allSettled` for concurrent I/O.',
      ],
      codeExample: {
        language: 'javascript',
        code: `// Avoid sequential waterfall
const [user, posts] = await Promise.all([
  fetchUser(id),
  fetchPosts(id)
]);`,
      },
      deepDive: 'In Service Workers, unawaited async work after a response is dispatched can result in worker termination before resolution.',
      mode,
    };
  }

  return {
    title: 'Async / Await: Asynchronous JavaScript',
    summary: 'Modern syntax that allows you to write asynchronous, Promise-based code in a readable, sequential style without messy nested `.then()` callbacks.',
    keyPoints: [
      'Functions marked `async` always return a Promise.',
      '`await` pauses execution until the Promise settles (resolves or rejects).',
      'Use standard `try...catch` blocks for clean error handling.',
    ],
    codeExample: {
      language: 'javascript',
      code: `try {
  const res = await fetch('/api/data');
  const json = await res.json();
} catch (err) {
  console.error('Fetch error:', err);
}`,
    },
    deepDive: null,
    mode,
  };
}

function generateShadowDomExplanation(term, mode) {
  if (mode === 'simple') {
    return {
      title: 'Shadow DOM: A Private Room Inside a Webpage',
      summary: 'Think of Shadow DOM like a soundproof room inside a busy building. Whatever loud music (CSS styles) you play inside the room never leaks out to bother others, and outside noise cannot get in either.',
      keyPoints: [
        'Keeps styles completely private and protected.',
        'Prevents website buttons from messing up extension designs.',
        'Essential for clean, professional browser tools.',
      ],
      codeExample: null,
      deepDive: null,
      mode,
    };
  }

  if (mode === 'advanced') {
    return {
      title: 'Shadow DOM: Encapsulation Trees & Event Retargeting',
      summary: 'A standard Web Component API that enables scoped style scoping, DOM tree encapsulation, and event retargeting. Composed trees pierce boundaries for rendering while isolating the active DOM query selectors.',
      keyPoints: [
        'Boundary Crossing: `document.querySelector` cannot pierce closed or open shadow roots without root traversal.',
        'Event Retargeting: Composed events re-target their `event.target` to the host element at the shadow boundary.',
        'AdoptedStyleSheets: Constructible stylesheets can be shared across multiple shadow roots without duplicated CSSOM memory.',
      ],
      codeExample: {
        language: 'javascript',
        code: `const host = document.createElement('div');
const shadow = host.attachShadow({ mode: 'open' });
const sheet = new CSSStyleSheet();
sheet.replaceSync('.card { color: #fff; }');
shadow.adoptedStyleSheets = [sheet];`,
      },
      deepDive: 'Chrome Extension Content Scripts leverage open Shadow Roots to guarantee host-invariance against hostile web page CSS resets.',
      mode,
    };
  }

  return {
    title: 'Shadow DOM: Scoped Web Components',
    summary: 'A browser standard that isolates HTML structure, CSS styling, and component behaviors from the global document context.',
    keyPoints: [
      'Styles defined inside the shadow root do not bleed out into the host page.',
      'Host page styles do not interfere with internal components.',
      'Forms the foundation of Web Components and isolated browser extension overlays.',
    ],
    codeExample: {
      language: 'javascript',
      code: `const shadowRoot = hostElement.attachShadow({ mode: 'open' });
shadowRoot.innerHTML = '<style>p { color: red; }</style><p>Isolated!</p>';`,
    },
    deepDive: null,
    mode,
  };
}

function generateCspExplanation(term, mode) {
  return {
    title: 'Content Security Policy (CSP)',
    summary: mode === 'simple'
      ? 'A security guard for websites that decides which scripts, images, and fonts are allowed to run and which ones must be blocked.'
      : 'An HTTP header and browser security layer that restricts resources (scripts, styles, workers, network calls) that a page can load, preventing Cross-Site Scripting (XSS) and code injection attacks.',
    keyPoints: [
      'Defines trusted sources for script execution (`script-src`).',
      'Blocks malicious inline scripts and unauthorized API requests.',
      'Chrome Extension Content Scripts execute in an isolated world unaffected by the host page CSP.',
    ],
    codeExample: null,
    deepDive: mode === 'advanced' ? 'Extensions in Manifest V3 adhere to strict extension-page CSPs prohibiting eval() and remote script hosting.' : null,
    mode,
  };
}

function generateMathExplanation(formula, mode) {
  return {
    title: 'Mathematical Expression',
    summary: mode === 'simple'
      ? `A mathematical relationship or formula representing quantitative logic or equations.`
      : `Represents a mathematical equation or functional relation${mode === 'advanced' ? ' with formal algebraic, differential, or probabilistic semantics.' : '.'}`,
    keyPoints: [
      'Relates variables and mathematical operators systematically.',
      'Can be evaluated algebraically or computed numerically.',
      mode === 'advanced' ? 'Check domain constraints, boundary conditions, and convergence properties.' : 'Commonly rendered using KaTeX or MathJax.',
    ],
    codeExample: {
      language: 'latex',
      code: formula,
      caption: 'LaTeX / TeX representation',
    },
    deepDive: mode === 'advanced' ? 'Ensure continuous differentiability across the definition domain before applying standard numeric optimization.' : null,
    mode,
  };
}

function generateGenericExplanation(text, mode, sentence, nearestHeading) {
  const preview = text.length > 50 ? text.slice(0, 50) + '...' : text;

  if (mode === 'simple') {
    return {
      title: `"${preview}"`,
      summary: `In simple terms, this concept refers to an important idea or mechanism${nearestHeading ? ` related to "${nearestHeading}"` : ''}. It helps organize information and achieve clear results.`,
      keyPoints: [
        'Easy to understand once you break it down into smaller parts.',
        'Works together with the surrounding sentences to convey key meaning.',
        'Widely used in everyday technical and educational reading.',
      ],
      codeExample: null,
      deepDive: null,
      mode,
    };
  }

  if (mode === 'advanced') {
    return {
      title: `Analysis: "${preview}"`,
      summary: `A precise architectural element or terminology in this domain. Its operational semantics depend on surrounding context, execution constraints, and formal design trade-offs.`,
      keyPoints: [
        'Domain Context: Interacts with surrounding systems and design parameters.',
        'Edge Scenarios: In high-throughput or distributed settings, boundary conditions must be validated.',
        'System Impact: Affects latency, maintainability, and structural modularity.',
      ],
      codeExample: null,
      deepDive: sentence ? `Contextual sentence: "${sentence.slice(0, 140)}..."` : 'Pay close attention to error-handling protocols and failover states.',
      mode,
    };
  }

  // Intermediate
  return {
    title: `Context & Meaning: "${preview}"`,
    summary: `A foundational term or passage${nearestHeading ? ` under "${nearestHeading}"` : ''}. It describes an established standard, process, or concept used to communicate structural and functional intent.`,
    keyPoints: [
      'Clear semantic role within the surrounding paragraph.',
      'Follows industry terminology conventions.',
      'Helps maintain clarity and accuracy across technical documentation.',
    ],
    codeExample: null,
    deepDive: null,
    mode,
  };
}

// ─── Simulated Follow-Up Responses ───────────────────────────────────

/**
 * Generate a smart response to user follow-up questions.
 *
 * @param {string} question
 * @param {Object} context
 * @returns {Promise<{ answer: string, codeExample?: CodeSnippet }>}
 */
export async function answerFollowUpQuestion(question, context) {
  // Simulate natural brief AI latency
  await new Promise((resolve) => setTimeout(resolve, 500));

  const q = question.toLowerCase();

  if (q.includes('example') || q.includes('code') || q.includes('how to use')) {
    return {
      answer: `Here is a practical, production-ready example demonstrating how "${context.selectedText.slice(0, 30)}" works in a real-world scenario:`,
      codeExample: {
        language: context.language || 'javascript',
        code: `// Practical application example
async function executeWorkflow(input) {
  const validated = validateInput(input);
  const result = await processTarget(validated);
  return { success: true, data: result };
}`,
        caption: 'Demonstration workflow',
      },
    };
  }

  if (q.includes('pitfall') || q.includes('mistake') || q.includes('avoid') || q.includes('issue')) {
    return {
      answer: `The most common pitfalls with "${context.selectedText.slice(0, 30)}" include:\n\n1. **Premature Optimization**: Applying it before profiling actual bottlenecks.\n2. **Unintended Side Effects**: Forgetting that mutations may leak into surrounding state.\n3. **Missing Error Boundaries**: Failing to handle network or edge-case timeouts gracefully.`,
    };
  }

  if (q.includes('why') || q.includes('when') || q.includes('benefit')) {
    return {
      answer: `You should choose this approach when you need predictable performance, maintainable interfaces, and clean separation of concerns. It reduces cognitive overhead for team members and prevents regression bugs.`,
    };
  }

  // Generic intelligent answer
  return {
    answer: `Regarding your question ("${question.slice(0, 60)}"): In this context, it directly reinforces the primary purpose of the selection. It ensures stability, handles edge conditions predictably, and keeps the overall architecture modular.`,
  };
}

/**
 * Fetch simulated explanation with a brief artificial delay to
 * demonstrate the shimmering loading skeleton state.
 *
 * @param {Object} context
 * @param {ExplanationLevel} mode
 * @returns {Promise<FormattedExplanation>}
 */
export async function fetchExplanationWithLatency(context, mode = 'intermediate') {
  await new Promise((resolve) => setTimeout(resolve, 400));
  return generateMockExplanation(context, mode);
}

