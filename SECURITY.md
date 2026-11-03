# Curio — Security Posture & Vulnerability Audit

> **Reviewed By:** Senior Browser Security Engineer  
> **Target:** Curio Extension (Chrome Manifest V3) & Synchronization Backend  
> **Status:** Passed Security Audit

---

## 1. Security Architecture & Threat Model

Browser extensions operate in high-privilege execution environments where security breaches can expose sensitive browsing activity. Curio enforces strict defense-in-depth across six core security boundaries:

```
┌────────────────────────────────────────────────────────┐
│                   Host Webpage DOM                     │
│  (Untrusted Scripts, CSP Resets, Dynamic SPA Renders)  │
└──────────────────────────▲─────────────────────────────┘
                           │ Isolated by Shadow DOM
┌──────────────────────────▼─────────────────────────────┐
│             Curio Content Script (IIFE)                │
│  • Sanitized Selection Capture                         │
│  • PII & Token Scrubbing                               │
│  • Zero dangerouslySetInnerHTML                        │
└──────────────────────────▲─────────────────────────────┘
                           │ Structured Extension Messaging
┌──────────────────────────▼─────────────────────────────┐
│           Background Service Worker (MV3)              │
│  • URL Boundary Checks (chrome://, webstore blocked)   │
│  • Least-Privilege Manifest Permissions                │
└──────────────────────────▲─────────────────────────────┘
                           │ Storage Isolation
┌──────────────────────────▼─────────────────────────────┐
│              Storage & Credentials                     │
│  • chrome.storage.local: API Keys (never synced)       │
│  • chrome.storage.sync: UI Preferences only            │
└────────────────────────────────────────────────────────┘
```

---

## 2. Security Controls & Audit Findings

### 2.1. API Key & Credential Isolation
- **Policy:** User-provided LLM API keys (Gemini, Groq, OpenAI, Anthropic) must **never** be synced to Google accounts or exposed to external telemetry.
- **Implementation:** [`src/shared/utils/storage.js`](file:///Volumes/My%20Files/Projects/Curio/src/shared/utils/storage.js) splits settings writes:
  ```javascript
  const { apiKey, ...syncSafeSettings } = newSettings;
  // Non-sensitive settings written to sync
  chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: syncSafeSettings });
  // API key stored exclusively on the local machine
  chrome.storage.local.set({ curio_api_key: apiKey });
  ```
- **Audit Verification:** Confirmed that `curio_api_key` is never placed in `chrome.storage.sync` or passed into URL query parameters.

### 2.2. PII & Token Redaction in Context Extraction
- **Policy:** URLs containing authentication credentials, single-sign-on tokens, or tracking hashes must be sanitized before processing.
- **Implementation:** [`src/content/context/index.js`](file:///Volumes/My%20Files/Projects/Curio/src/content/context/index.js) sanitizes URLs by stripping:
  - Auth parameters: `token`, `auth`, `key`, `secret`, `session`, `sid`, `password`, `access_token`, `refresh_token`, `api_key`, `jwt`.
  - Tracking parameters: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `fbclid`, `gclid`, `mc_eid`.
  - Excessive base64 hashes ($>30$ characters) frequently used for single-use access tokens.

### 2.3. Form Field Credential Protection
- **Policy:** Form fields holding passwords or sensitive authentication input must not be read or extracted by the selection engine.
- **Implementation:** [`src/content/selection/inputSelector.js`](file:///Volumes/My%20Files/Projects/Curio/src/content/selection/inputSelector.js) explicitly evaluates input types:
  ```javascript
  export function isPasswordInput(el) {
    if (!el) return false;
    return (el.type || '').toLowerCase() === 'password';
  }
  ```
  If `isPasswordInput` returns `true`, the selection strategy immediately aborts and returns `null`.

### 2.4. Cross-Site Scripting (XSS) Prevention
- **Strict Content Security Policy (CSP):** The extension runs under Manifest V3 defaults prohibiting `eval()`, `new Function()`, and remotely hosted scripts (`script-src 'self'`).
- **No `dangerouslySetInnerHTML`:** The floating React interface renders text and code through safe JSX children text nodes. Syntax highlights are generated via tokenized `<span>` nodes without innerHTML injection.
- **Host DOM Isolation:** The floating interface mounts into a dedicated `<curio-host>` element inside an open Shadow DOM root. Host page scripts cannot access or alter internal components without explicit traversal.

### 2.5. Logging Discipline
- **Policy:** Sensitive user selection text, passwords, or decrypted API keys must never appear in unredacted console logs.
- **Implementation:** Content script and background worker logs report only metadata (`contentType`, `language`, `selectedLength`) rather than raw string contents.

### 2.6. Backend API Security
The synchronization backend ([`backend/src/server.js`](file:///Volumes/My%20Files/Projects/Curio/backend/src/server.js)) implements:
1. **Helmet Security Headers:** Protects against MIME sniffing, clickjacking (`X-Frame-Options`), and cross-domain leaks.
2. **CORS Origin Filtering:** Rejects arbitrary external web requests, permitting only verified `chrome-extension://` origins and configured domains.
3. **Rate Limiting:** Protects against abuse via `express-rate-limit` ($100$ requests per $15$ minutes per IP).
4. **Zod Runtime Schema Validation:** Every incoming endpoint payload is validated before SQL execution.
5. **Parameterized Queries:** All SQL queries use parameter placeholders (`$1`, `$2`), eliminating SQL injection vulnerabilities.

---

## 3. Least-Privilege Manifest Permissions

Curio requests only the absolute minimum permissions required:
- `storage`: Required for local settings, credentials, and glossary persistence.
- `activeTab`: Grants temporary, user-initiated access to the active webpage when the user presses `Alt+Shift+E` or clicks the extension icon.
- `contextMenus`: Adds the optional right-click "Explain with Curio" action.

**Excluded Permissions:**
- ❌ `tabs`: Not requested (protects user privacy; extension cannot inspect browsing history or background tabs).
- ❌ `<all_urls>` under `permissions`: Only used in `content_scripts.matches` for in-page overlay injection.
- ❌ `webRequest` / `cookies`: Not requested.

---

## 4. Responsible Disclosure

To report a vulnerability or security concern, please submit a detailed advisory to `security@curio.ai` with steps to reproduce.

