# Curio — Server-Sent Events (SSE) Streaming Protocol

This document defines the wire specification for Curio's real-time streaming pipeline between the browser extension and the backend service.

---

## 1. Transport & Connection Setup

All streaming endpoints (`/api/v1/explain/stream` and `/api/v1/explain/follow-up/stream`) utilize standard HTTP Server-Sent Events (SSE) over persistent HTTP connections.

### Response Headers
Upon accepting a valid request, the server responds with:

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
Access-Control-Allow-Origin: *
```

---

## 2. Event Specification

Each frame follows the W3C EventSource wire format:
```
event: <event_name>\n
data: <json_string>\n\n
```

### 2.1. `event: start`
Dispatched immediately when the server initializes the stream with an upstream AI provider.

```
event: start
data: {"requestId":"req_35252435-0c31-41a7","provider":"gemini","model":"gemini-2.0-flash"}

```

| Field | Type | Description |
| :--- | :--- | :--- |
| `requestId` | string | Unique UUID assigned to the streaming session |
| `provider` | string | Active AI provider serving the request (`gemini` \| `groq`) |
| `model` | string | Upstream model identifier |

---

### 2.2. `event: delta`
Dispatched for each incremental chunk of generated Markdown explanation text.

```
event: delta
data: {"text":"**Map** is a higher-order function that applies..."}

```

| Field | Type | Description |
| :--- | :--- | :--- |
| `text` | string | Raw UTF-8 text slice to append to the live preview |

---

### 2.3. `event: done`
Dispatched when generation has finished cleanly and all text has been flushed. Indicates the stream is closed.

```
event: done
data: {"requestId":"req_35252435-0c31-41a7","provider":"gemini","model":"gemini-2.0-flash","usage":{"promptTokens":42,"outputTokens":118,"totalTokens":160}}

```

| Field | Type | Description |
| :--- | :--- | :--- |
| `requestId` | string | Session identifier matching `start` |
| `provider` | string | Provider that completed the generation |
| `model` | string | Model used |
| `usage` | object \| null | Token accounting metadata (prompt, output, total tokens) |

---

### 2.4. `event: error`
Dispatched if an unrecoverable error occurs (or after failover options are exhausted).

```
event: error
data: {"code":"RATE_LIMITED","message":"Gemini quota reached. Retrying with Groq...","retryable":true}

```

| Field | Type | Description |
| :--- | :--- | :--- |
| `code` | string | Normalized error code (e.g., `RATE_LIMITED`, `AUTHENTICATION_ERROR`) |
| `message` | string | User-friendly explanation of the issue |
| `retryable` | boolean | Suggests whether the UI should show a Retry button |

---

## 3. Network Chunk Boundaries & Reassembly

TCP and HTTP chunk boundaries do not necessarily align with newline-delimited SSE frames. A single network chunk may contain:
- A partial line
- Multiple frames
- A frame split right across `\n\n`

### Parser Algorithm (`src/content/overlay/streamingClient.js`)
```javascript
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const parts = buffer.split('\n\n');
  
  // Keep the last segment in buffer if incomplete
  buffer = parts.pop() || '';

  for (const block of parts) {
    if (!block.trim()) continue;
    const event = parseSSEBlock(block);
    dispatchToListeners(event);
  }
}
```

---

## 4. Client Cancellation & Sockets Cleanup

When a user clicks **Stop** or closes the overlay during an active generation:

1. The frontend invokes `AbortController.abort()`.
2. The browser immediately closes the HTTP connection.
3. The server receives `req.on('close')`.
4. The server calls the upstream provider's `abortSignal`, aborting the fetch request to Google/Groq.
5. Server resources and upstream token consumption stop immediately.

