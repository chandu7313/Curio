# Curio Universal Text Selection Engine

> **Architecture, Implementation, and Multi-Strategy Pipeline Documentation**  
> *Antigravity Agentic Engineering — Chrome Extension Manifest V3 (Pure JavaScript)*

---

## 1. Architectural Philosophy

The **Curio Universal Text Selection Engine** is designed to capture user selections reliably, safely, and cleanly across the entire web without relying on website-specific hacks or fragile scraping logic. 

```
                                  [ User Selection Event ]
                                             │
                                             ▼
                        ┌─────────────────────────────────────────┐
                        │    Multi-Strategy Selection Pipeline    │
                        ├─────────────────────────────────────────┤
                        │ 1. Form Inputs  (<input>, <textarea>)   │
                        │ 2. Shadow DOM   (Deep activeElement)    │
                        │ 3. Editable DOM (contenteditable roots) │
                        │ 4. IFrames      (Same-origin & subframe)│
                        │ 5. Standard DOM (window.getSelection)   │
                        └────────────────────┬────────────────────┘
                                             │ Raw Selection
                                             ▼
                        ┌─────────────────────────────────────────┐
                        │      Content & Structural Classifier    │
                        ├─────────────────────────────────────────┤
                        │ • ContentType: code, math, terms, abbr  │
                        │ • SelectionType: word, sentence, para   │
                        └────────────────────┬────────────────────┘
                                             │ Normalized Selection
                                             ▼
                        ┌─────────────────────────────────────────┐
                        │       Context Extraction Engine         │
                        ├─────────────────────────────────────────┤
                        │ • Enclosing sentence boundary detection │
                        │ • Semantic container & paragraph text   │
                        │ • Nearest heading hierarchy             │
                        │ • URL & credential privacy scrubbing    │
                        │ • Viewport bounding box serialization   │
                        └────────────────────┬────────────────────┘
                                             │ Standardized Object
                                             ▼
                        ┌─────────────────────────────────────────┐
                        │ In-Situ Floating UI / Service Worker IPC│
                        └─────────────────────────────────────────┘
```

### Core Design Tenets
1. **Generic Over Hardcoded**: Browser internal mechanisms (Selection API, Range API, activeElement, ShadowRoot traversal) are prioritized over brittle site-specific DOM selectors.
2. **Zero Host Page Pollution**: Operates entirely in the extension's isolated world; floating interfaces and notification toasts are mounted inside open Shadow DOM trees with `all: initial` reset.
3. **Strict Security & Privacy**: Password fields are rejected by design (`isPasswordInput`). Sensitive query parameters (`token`, `auth`, `api_key`, `session`, `jwt`) are automatically stripped from target URLs.
4. **Token Economy**: Bounded context extraction algorithms prevent sending entire web pages to AI models, conserving LLM token consumption while providing sufficient context to disambiguate technical terms.
5. **Pure JavaScript**: Strictly adheres to standard ECMAScript modules (ES6+), React 19 JSX, and Zod runtime schema validation without introducing TypeScript dependencies.

---

## 2. Multi-Strategy Selection Pipeline

Standard browser `window.getSelection()` fails on form controls, Shadow DOM web components, and certain rich-text editors. Curio orchestrates a priority-ordered fallback cascade in `src/content/selection/index.js`:

```javascript
function captureRawSelection() {
  // Strategy 1: Form inputs (highest priority when focused)
  const inputSel = getInputSelection();
  if (inputSel) return { raw: inputSel, strategy: 'input' };

  // Strategy 2: Shadow DOM (pierces shadow boundaries)
  const shadowSel = getShadowDOMSelection();
  if (shadowSel) return { raw: shadowSel, strategy: 'shadow' };

  // Strategy 3: Contenteditable regions (rich text editors)
  const editableSel = getEditableSelection();
  if (editableSel) return { raw: editableSel, strategy: 'contenteditable' };

  // Strategy 4: IFrame (same-origin iframe focused or active)
  const iframeSel = getIframeSelection();
  if (iframeSel) return { raw: iframeSel, strategy: 'iframe' };

  // Strategy 5: Standard DOM selection (articles, blogs, prose)
  const standardSel = getStandardSelection();
  if (standardSel) return { raw: standardSel, strategy: 'standard' };

  return null;
}
```

### Strategy 1: Form Input & Textarea Selector (`inputSelector.js`)
- **Problem**: Browsers explicitly hide input and textarea selections from `window.getSelection()`.
- **Solution**: Inspects `document.activeElement`. If the element is an `HTMLInputElement` or `HTMLTextAreaElement`, reads `selectionStart` and `selectionEnd` slice indices.
- **Security Guard**: Explicitly checks `isPasswordInput(el)`. Elements with `type="password"` return `null` immediately to prevent password scraping.

### Strategy 2: Shadow DOM Selector (`shadowSelector.js`)
- **Problem**: Modern web components (YouTube, Shoelace, Lit components) encapsulate internal DOM in shadow trees that standard DOM queries cannot reach.
- **Solution**: Recursively traverses `document.activeElement` chains (`el.shadowRoot.activeElement`) to locate the deepest focused shadow host. Invokes `root.getSelection()` where supported by Chromium, or queries internal input controls.

### Strategy 3: Contenteditable Selector (`editableSelector.js`)
- **Problem**: Rich text editors (Medium, Notion, Google Docs web canvas, ProseMirror) wrap text inside `contenteditable="true"` blocks with complex DOM span fragmentation.
- **Solution**: Detects `isContentEditable` ancestor chains, retrieves the current `Range`, and normalizes paragraph and cursor offsets.

### Strategy 4: IFrame Selector (`iframeSelector.js`)
- **Problem**: Selections inside embedded frames have disconnected coordinate spaces.
- **Solution**:
  - **Same-Origin Frames**: Accesses `iframe.contentDocument.getSelection()`, calculates inner selection client rects, and translates coordinates by adding `frame.getBoundingClientRect().top` and `left`.
  - **Cross-Origin Frames**: Protected by the browser's Same-Origin Policy. Supported seamlessly via `"all_frames": true` in `manifest.json`, running independent content scripts inside each frame.

### Strategy 5: Standard DOM Selector (`standardSelector.js`)
- **Solution**: Utilizes `window.getSelection()` and `range.getBoundingClientRect()`. Guards against detached ranges or zero-width collapsed selections.

---

## 3. Content and Structural Classification Engine

Once a selection is captured, `src/content/selection/classifier.js` categorizes it across two orthogonal axes:

### A. Content Type (`contentType`)
| Content Type | Criteria & Identification Logic |
| :--- | :--- |
| `programming_code` | Selection is inside `<pre>`, `<code>`, `.highlight`, `.cm-editor`, `.s-code-block`, or contains programming syntax (`const x =`, `function()`, `import ... from`, `def foo():`, `class Foo {`, `=>`) |
| `mathematical_expression` | Selection is inside `.katex`, `mjx-container`, `math`, or contains TeX patterns (`\frac`, `\sum`, `\int`, `\sqrt`, `\alpha`, `\partial`, `$E=mc^2$`, `f(x) = x^2`) |
| `abbreviation` | 2 to 6 uppercase alphanumeric characters (`API`, `DOM`, `HTML`, `CSS`, `JSON`, `REST`, `GraphQL`, `MV3`) or dotted abbreviations (`e.g.`, `i.e.`, `etc.`) |
| `technical_terminology` | camelCase identifiers (`useMemo`, `addEventListener`), PascalCase classes (`MutationObserver`), snake_case variables (`selection_start`), dot-notation (`window.getSelection`), or curated CS concepts (`polymorphism`, `concurrency`, `idempotency`, `memoization`, `closure`, `recursion`) |
| `general_text` | Standard natural language text, sentences, phrases, and paragraphs |
| `other` | Symbols, ASCII art, or unclassified character sequences |

### B. Selection Type (`selectionType`)
| Selection Type | Criteria |
| :--- | :--- |
| `word` | Single word or atomic identifier (`words.length === 1`) |
| `sentence` | Natural sentence, clause, or multi-word phrase within a single block |
| `paragraph` | Comprehensive paragraph (>= 25 words, multi-sentence, or matching enclosing block text) |
| `multi_paragraph` | Text containing explicit blank lines (`\n\s*\n` or `\r\n\s*\r\n`) |
| `code` | Selection classified as programming code |
| `math` | Selection classified as mathematical expression |

---

## 4. Code Block Normalization (`codeSelector.js`)

When users copy or select code from sites like GitHub, Stack Overflow, or ChatGPT, selections are often corrupted by line numbers and UI button text:
1. **Line Number Gutters**:
   - Detects if >60% of lines begin with leading digits (`^\s*\d+\s{1,4}`).
   - Strips tab-separated line numbers (`^\d+\t`).
2. **Copy Button Artifacts**:
   - Strips LLM chat headers: `/^\s*Copy(?:\s+(?:code|to clipboard|snippet))?\s*$/gim`.
   - Strips copy confirmation tooltips: `/^\s*Copied!?(?:\s*to clipboard)?\s*$/gim`.
3. **Syntax Language Detection**:
   - Inspects classes up to 4 levels up for `language-xxx`, `lang-xxx`, and `hljs xxx`.
   - Checks `data-language` and `data-lang` attributes.

---

## 5. Mathematical Expression Recovery (`mathSelector.js`)

Rendered math libraries (KaTeX and MathJax) convert mathematical symbols into dozens of nested `<span>` tags and SVG glyphs. Normal text selection yields fragmented junk.

Curio extracts the clean underlying LaTeX/TeX source:
- **KaTeX**: Extracts from `<annotation encoding="application/x-tex">` or `data-tex` attributes.
- **MathJax 2.x**: Locates sibling `<script type="math/tex">` tags.
- **MathJax 3.x**: Locates internal semantic MathML `<annotation>` nodes or `aria-label` TeX source.
- **MathML**: Extracts `alttext` or annotation source.

---

## 6. Context Extraction & Token Economy (`context/index.js`)

To provide intelligent explanations without sending entire web pages, `extractContext()` performs focused semantic extraction:

1. **Semantic Container Resolution**:
   - Walks up the DOM to find the nearest block-level container.
   - Tailored for modern platforms:
     - ChatGPT: `[data-message-author-role="assistant"]`, `.agent-turn`, `.prose`
     - Claude: `.font-claude-message`, `[data-is-streaming]`
     - Gemini: `model-response`, `.response-container-content`
     - Perplexity: `.prose`
     - Developer Docs: `.markdown-body`, `.s-prose`, `.theme-doc-markdown`, `.vp-doc`
2. **Sentence Boundary Detection**:
   - Splits block text using boundary regex `[^.!?]+(?:[.!?]+(?:\s+|$)|$)`.
   - Finds the exact enclosing sentence containing the selected text.
3. **Surrounding Window**:
   - Extracts a bounded 500-character context window before and after the selection.
4. **Heading Hierarchy**:
   - Traverses previous siblings and ancestors to locate the nearest preceding heading (`h1` through `h6`).
5. **URL Privacy Sanitization**:
   - Strips sensitive query parameters: `token`, `auth`, `key`, `secret`, `session`, `password`, `api_key`, `jwt`, `utm_*`, `fbclid`, `gclid`.

---

## 7. Keyboard Shortcut & Snapshot Preservation

### The Focus Collapse Problem
When a user presses a keyboard shortcut like `Alt + Shift + E`, the browser window may trigger chrome command listeners, causing an active text selection or textarea focus to collapse or clear before the extension script can read `window.getSelection()`.

### The Curio Solution
Curio maintains a **10-second Time-To-Live (TTL) Selection Snapshot Cache**:
1. Passive event listeners track selection state across:
   - `pointerup` (debounced 120ms)
   - `keyup` (debounced 120ms)
   - `selectionchange` (debounced 120ms)
   - `input` (debounced 120ms)
2. `captureSelectionWithFallback()` attempts to read the live selection first. If collapsed or empty, it automatically falls back to `lastValidSnapshot` if it is younger than 10,000ms.
3. Plain clicks that collapse selection immediately flush stale snapshots.

---

## 8. Standardized SelectionSnapshot Data Contract

Every capture yields a standardized payload validated at runtime with Zod:

```javascript
/**
 * @typedef {Object} SelectionSnapshot
 * @property {string} selectedText - Cleaned, normalized selection text
 * @property {string} surroundingSentence - Full enclosing sentence
 * @property {string} surroundingParagraph - Enclosing paragraph or container text
 * @property {string} pageTitle - Document title
 * @property {string} pageUrl - Privacy-sanitized URL
 * @property {'general_text'|'programming_code'|'technical_terminology'|'mathematical_expression'|'abbreviation'|'other'} contentType
 * @property {'word'|'sentence'|'paragraph'|'multi_paragraph'|'code'|'math'} selectionType
 * @property {SelectionRect|null} selectionRect - { top, left, width, height }
 * @property {number} timestamp - Epoch timestamp of capture
 */
```

### Backward Compatibility
All existing consumer components, UI widgets, and legacy IPC handlers receive automatic field aliases:
- `sentence` ⟷ `surroundingSentence`
- `paragraph` ⟷ `surroundingParagraph`
- `boundingBox` ⟷ `selectionRect`
- `nodeType` ⟷ `contentType`

