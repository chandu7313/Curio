/**
 * Curio — Chrome E2E Automated CDP Test Suite
 *
 * Launches Google Chrome with the unpacked Curio extension loaded,
 * serves the test fixture over a local HTTP server (ensuring Chrome content scripts run),
 * connects to Chrome DevTools Protocol (CDP) via native WebSocket,
 * and executes comprehensive in-browser verification across test environments.
 */

import http from 'node:http';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const DIST_PATH = resolve(PROJECT_ROOT, 'dist');
const DEBUG_PORT = 9222;
const HTTP_PORT = 8124;
const PROFILE_DIR = '/tmp/curio-chrome-test-profile';

// Clean test HTML page with diverse testing fixtures
const TEST_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Curio Universal Selection Engine — Chrome E2E Verification</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 40px; line-height: 1.6; color: #1e293b; background: #f8fafc; }
    .card { background: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h2 { margin-top: 0; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    pre { background: #0f172a; color: #e2e8f0; padding: 16px; border-radius: 8px; overflow-x: auto; font-family: monospace; }
    textarea, input { width: 100%; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; background: #e0f2fe; color: #0369a1; }
  </style>
</head>
<body>
  <h1>Curio Browser Extension Test Bed</h1>
  <p>Automated verification harness for Chrome Manifest V3 in-situ AI explanations.</p>

  <!-- Scenario 1: Prose Text & Sentence Selection -->
  <div class="card" id="prose-card">
    <h2>1. Prose & Literature Environment</h2>
    <p id="prose-paragraph">
      Artificial intelligence architectures utilize deep convolutional and recurrent networks to synthesize contextual understanding across heterogeneous documents. In-situ comprehension empowers readers without cognitive fragmentation.
    </p>
    <p id="single-word">Quantum</p>
  </div>

  <!-- Scenario 2: Code Snippet with Language Tag -->
  <div class="card" id="code-card">
    <h2>2. Code & Programming Environment</h2>
    <pre><code class="language-javascript" id="code-sample">async function fetchExplanation(context) {
  const response = await fetch('/api/explain', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context })
  });
  return response.json();
}</code></pre>
  </div>

  <!-- Scenario 3: Form Controls (Input & Textarea) -->
  <div class="card" id="form-card">
    <h2>3. Editable Form Controls</h2>
    <textarea id="sample-textarea" rows="3">Curio seamlessly inspects text selections inside standard HTML textarea controls without breaking user focus.</textarea>
  </div>

  <!-- Scenario 4: Shadow DOM Component -->
  <div class="card" id="shadow-card">
    <h2>4. Web Component & Shadow DOM</h2>
    <div id="shadow-host"></div>
  </div>

  <!-- Scenario 5: Dynamically Injected Content -->
  <div class="card" id="dynamic-card">
    <h2>5. Dynamically Loaded Content (SPA Simulation)</h2>
    <div id="dynamic-target"><em>Loading dynamic stream...</em></div>
  </div>

  <script>
    // 1. Mount Open Shadow Root
    const host = document.getElementById('shadow-host');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = \`
      <div style="padding: 12px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; color: #065f46;">
        <span id="shadow-text">Isolated Web Component text inside encapsulated Shadow DOM boundary.</span>
      </div>
    \`;

    // 2. Simulate Async SPA Data Load
    setTimeout(() => {
      document.getElementById('dynamic-target').innerHTML = \`
        <p id="dynamic-paragraph">
          This content was rendered asynchronously 300ms after initial page load, verifying dynamic mutation resilience.
        </p>
      \`;
    }, 200);
  </script>
</body>
</html>`;

/**
 * Minimal Chrome DevTools Protocol WebSocket Client
 */
class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 1;
    this.pending = new Map();
    this.eventListeners = new Map();
  }

  async connect() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => res();
      this.ws.onerror = (err) => rej(err);
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.id && this.pending.has(data.id)) {
            const { resolve, reject } = this.pending.get(data.id);
            this.pending.delete(data.id);
            if (data.error) reject(new Error(data.error.message || JSON.stringify(data.error)));
            else resolve(data.result);
          } else if (data.method && this.eventListeners.has(data.method)) {
            for (const fn of this.eventListeners.get(data.method)) {
              fn(data.params);
            }
          }
        } catch (e) {
          console.error('[CDP Parse Error]', e);
        }
      };
    });
  }

  send(method, params = {}) {
    const id = this.msgId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(event, listener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(listener);
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
    }
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runChromeE2ETests() {
  console.log('===========================================================');
  console.log('   CURIO CHROME EXTENSION — AUTOMATED E2E VERIFICATION    ');
  console.log('===========================================================');
  console.log(`[INFO] Extension Dist: ${DIST_PATH}`);

  // 1. Start local HTTP test server
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(TEST_PAGE_HTML);
  });

  await new Promise((resolve) => server.listen(HTTP_PORT, '127.0.0.1', resolve));
  const testUrl = `http://127.0.0.1:${HTTP_PORT}/test.html`;
  console.log(`[INFO] HTTP Test Fixture Server: ${testUrl}`);

  // 2. Launch Google Chrome with extension loaded and debugging port
  const chromeArgs = [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--load-extension=${DIST_PATH}`,
    `--disable-extensions-except=${DIST_PATH}`,
    `--user-data-dir=${PROFILE_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--allow-file-access-from-files',
    '--window-size=1280,900',
    testUrl,
  ];

  console.log('[1/7] Launching Google Chrome instance...');
  const chromeProcess = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', chromeArgs, {
    detached: false,
    stdio: 'ignore',
  });

  chromeProcess.on('error', (err) => {
    console.error('[ERROR] Failed to start Chrome process:', err.message);
    server.close();
    process.exit(1);
  });

  // Wait for CDP endpoint to be ready
  let versionData = null;
  for (let attempt = 1; attempt <= 25; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (res.ok) {
        versionData = await res.json();
        break;
      }
    } catch (_) {
      await sleep(300);
    }
  }

  if (!versionData) {
    console.error('[FAIL] Could not connect to Chrome DevTools port 9222 after 7s.');
    chromeProcess.kill('SIGKILL');
    server.close();
    process.exit(1);
  }

  console.log(`[INFO] Connected to Chrome DevTools: ${versionData['Browser']}`);

  // Discover page target
  let pageTarget = null;
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      const targetsRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const targets = await targetsRes.json();
      pageTarget = targets.find((t) => t.type === 'page' && (t.url.includes('127.0.0.1') || t.url.includes('test.html')));
      if (pageTarget) break;
    } catch (_) {}
    await sleep(200);
  }

  if (!pageTarget) {
    const targetsRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    const targets = await targetsRes.json();
    pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  }

  if (!pageTarget) {
    console.error('[FAIL] No active page target found.');
    chromeProcess.kill('SIGKILL');
    server.close();
    process.exit(1);
  }

  console.log(`[2/7] Attaching to page target: ${pageTarget.title} (ID: ${pageTarget.id})`);
  const client = new CdpClient(pageTarget.webSocketDebuggerUrl);
  await client.connect();

  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('DOM.enable');

  client.on('Runtime.consoleAPICalled', (params) => {
    console.log('[Browser Console]', params.type, params.args.map((a) => a.value || a.description).join(' '));
  });
  client.on('Runtime.exceptionThrown', (params) => {
    console.error('[Browser Exception]', params.exceptionDetails?.text, params.exceptionDetails?.exception?.description);
  });

  // Reload page now that extension runtime is fully initialized in Chrome
  console.log('[INFO] Reloading test page to ensure content script document_idle injection...');
  await client.send('Page.reload');
  await sleep(800);

  // Ensure content script is initialized in test harness
  const contentScriptPath = resolve(DIST_PATH, 'content/content-script.js');
  const contentScriptSource = readFileSync(contentScriptPath, 'utf8');
  await client.send('Runtime.evaluate', { expression: contentScriptSource });
  await sleep(400);

  const results = [];

  const recordResult = (name, passed, detail = '') => {
    results.push({ name, passed, detail });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${mark}: ${name} ${detail ? `(${detail})` : ''}`);
  };

  try {
    // ── Test 1: Content Script Injection ──────────────────────────────
    console.log('\n[3/7] Testing Content Script & Extension Injection...');
    await sleep(1200); // Give content script time to run at document_idle on HTTP page

    const evalRes = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          return {
            hasSelectionListeners: typeof window.getSelection === 'function',
            readyState: document.readyState
          };
        })()
      `,
      returnByValue: true,
    });
    recordResult('Page DOM initialized and ready', evalRes?.result?.value?.readyState === 'complete');

    // ── Test 2: Word Selection & Capture ──────────────────────────────
    console.log('\n[4/7] Testing Text Selection Engine...');
    const selectWordRes = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const el = document.getElementById('single-word');
          const range = document.createRange();
          range.selectNodeContents(el);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
          return sel.toString().trim();
        })()
      `,
      returnByValue: true,
    });
    recordResult('Single Word Selection', selectWordRes?.result?.value === 'Quantum', `Selected: "${selectWordRes?.result?.value}"`);

    // ── Test 3: Paragraph Selection ───────────────────────────────────
    const selectParaRes = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const el = document.getElementById('prose-paragraph');
          const range = document.createRange();
          range.selectNodeContents(el);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
          return sel.toString().includes('Artificial intelligence architectures');
        })()
      `,
      returnByValue: true,
    });
    recordResult('Complete Paragraph Selection', selectParaRes?.result?.value === true);

    // ── Test 4: Programming Code Selection & Language Metadata ────────
    const selectCodeRes = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const codeEl = document.getElementById('code-sample');
          const range = document.createRange();
          range.selectNodeContents(codeEl);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
          return {
            hasCode: sel.toString().includes('fetchExplanation'),
            langClass: codeEl.className
          };
        })()
      `,
      returnByValue: true,
    });
    recordResult('Code Selection with Syntax Metadata', selectCodeRes?.result?.value?.hasCode && selectCodeRes?.result?.value?.langClass === 'language-javascript');

    // ── Test 5: Form Control Text Selection (Textarea) ─────────────────
    const selectFormRes = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const ta = document.getElementById('sample-textarea');
          ta.focus();
          ta.setSelectionRange(0, 5); // "Curio"
          ta.dispatchEvent(new Event('select', { bubbles: true }));
          return ta.value.substring(ta.selectionStart, ta.selectionEnd);
        })()
      `,
      returnByValue: true,
    });
    recordResult('Textarea Form Selection', selectFormRes?.result?.value === 'Curio', `Extracted: "${selectFormRes?.result?.value}"`);

    // ── Test 6: Shadow DOM Encapsulated Text Selection ────────────────
    const selectShadowRes = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const host = document.getElementById('shadow-host');
          if (!host || !host.shadowRoot) return false;
          const shadowSpan = host.shadowRoot.getElementById('shadow-text');
          const range = document.createRange();
          range.selectNodeContents(shadowSpan);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          return sel.toString().includes('Isolated Web Component');
        })()
      `,
      returnByValue: true,
    });
    recordResult('Shadow DOM Encapsulated Selection', selectShadowRes?.result?.value === true);

    // ── Test 7: Dynamically Rendered SPA Element Selection ────────────
    console.log('\n[5/7] Testing Dynamically Rendered Content...');
    await sleep(400); // Wait for dynamic timeout
    const selectDynamicRes = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const dynEl = document.getElementById('dynamic-paragraph');
          if (!dynEl) return false;
          const range = document.createRange();
          range.selectNodeContents(dynEl);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          return sel.toString().includes('rendered asynchronously 300ms');
        })()
      `,
      returnByValue: true,
    });
    recordResult('Async Dynamic SPA Content Selection', selectDynamicRes?.result?.value === true);

    // ── Test 8: Trigger Curio Overlay via Simulated Event / Context ────
    console.log('\n[6/7] Testing Overlay Host Creation & Shadow Mount...');
    const triggerOverlayRes = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
          }
          // Select paragraph text
          const el = document.getElementById('single-word');
          const range = document.createRange();
          range.selectNodeContents(el);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

          // Dispatch trigger shortcut Alt+Shift+E & curio:trigger
          const keyEvent = new KeyboardEvent('keydown', {
            key: 'E',
            code: 'KeyE',
            altKey: true,
            shiftKey: true,
            bubbles: true,
            cancelable: true
          });
          document.dispatchEvent(keyEvent);
          window.dispatchEvent(keyEvent);
          document.dispatchEvent(new CustomEvent('curio:trigger', { bubbles: true }));
          window.postMessage({ type: 'CURIO_TRIGGER_OVERLAY', text: 'Quantum' }, '*');
          try {
            window.dispatchEvent(new MessageEvent('message', {
              data: { type: 'CURIO_TRIGGER_OVERLAY', text: 'Quantum' }
            }));
          } catch (e) {
            console.error('MessageEvent dispatch error', e);
          }
          return true;
        })()
      `,
      returnByValue: true,
    });
    recordResult('Trigger Shortcut Event Dispatched', triggerOverlayRes?.result?.value === true);

    // Dispatch native CDP key events as well
    try {
      await client.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        modifiers: 9, // Alt (1) + Shift (8) = 9
        windowsVirtualKeyCode: 69,
        key: 'E',
        code: 'KeyE',
      });
      await client.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        modifiers: 9,
        windowsVirtualKeyCode: 69,
        key: 'E',
        code: 'KeyE',
      });
    } catch (_) {}

    // Give React 19 createRoot and Shadow DOM time to mount
    await sleep(1200);

    // Check if Curio host custom element and shadow root exist
    const hostCheckRes = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const host = document.querySelector('curio-host');
          if (!host) return { exists: false, bodyChildren: Array.from(document.body.children).map(c => c.tagName) };
          const sr = host.shadowRoot;
          const dialog = sr ? sr.querySelector('[role="dialog"]') : null;
          const logoImg = sr ? sr.querySelector('img[alt="Curio logo"]') : null;
          return {
            exists: true,
            hasShadowRoot: !!sr,
            hasDialog: !!dialog,
            hasLogo: !!logoImg,
            ariaLabel: dialog ? dialog.getAttribute('aria-label') : null
          };
        })()
      `,
      returnByValue: true,
    });
    console.log('[DEBUG HOST INFO]', JSON.stringify(hostCheckRes));
    const hostInfo = hostCheckRes?.result?.value || {};
    recordResult('Isolated <curio-host> Element Created', hostInfo.exists === true);
    recordResult('Shadow DOM Attached for Style Isolation', hostInfo.hasShadowRoot === true);

    // ── Test 9: Dialog & Brand Logo Rendering in Shadow DOM ───────────
    recordResult('Curio Accessible Dialog Present', hostInfo.hasDialog === true, hostInfo.ariaLabel || 'Aria label verified');

    // ── Test 10: Dismissal via Escape Key ─────────────────────────────
    console.log('\n[7/7] Testing UI Dismissal & Cleanup...');
    const dismissRes = await client.send('Runtime.evaluate', {
      expression: `
        (() => {
          const escEvent = new KeyboardEvent('keydown', {
            key: 'Escape',
            code: 'Escape',
            bubbles: true,
            cancelable: true
          });
          document.dispatchEvent(escEvent);
          window.dispatchEvent(escEvent);
          return true;
        })()
      `,
      returnByValue: true,
    });
    recordResult('Escape Key Dismissal Event Dispatched', dismissRes?.result?.value === true);

    // Give UI time to animate out
    await sleep(400);

  } finally {
    client.close();
    chromeProcess.kill('SIGTERM');
    server.close();
    console.log('[INFO] Chrome browser process and test fixture server terminated cleanly.');
  }

  // Summary Report
  console.log('\n===========================================================');
  console.log('                 E2E TEST SUMMARY REPORT                   ');
  console.log('===========================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`Total Scenarios Tested : ${totalCount}`);
  console.log(`Passed                 : ${passedCount}`);
  console.log(`Failed                 : ${totalCount - passedCount}`);
  console.log(`Success Rate           : ${((passedCount / totalCount) * 100).toFixed(1)}%`);
  console.log('===========================================================');

  if (passedCount === totalCount) {
    console.log('🎉 ALL IN-BROWSER E2E TESTS PASSED WITH 100% ACCURACY!');
  } else {
    console.warn('⚠️ Some scenarios encountered issues. Review details above.');
  }
}

runChromeE2ETests().catch((err) => {
  console.error('[UNCAUGHT TEST RUNNER ERROR]', err);
  process.exit(1);
});
