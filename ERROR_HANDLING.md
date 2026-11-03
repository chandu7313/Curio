# Curio — Error Handling, Failover & Resilience

This document outlines Curio's comprehensive error taxonomy, provider failover mechanics, mid-stream isolation guarantees, and client recovery workflows.

---

## 1. Normalized Error Taxonomy

All server and upstream errors are normalized into standard codes before being surfaced to the client:

| Error Code | HTTP Status | Retryable | Description |
| :--- | :--- | :--- | :--- |
| `AUTHENTICATION_ERROR` | 401 / 403 | No | Missing, invalid, or expired API key. |
| `RATE_LIMITED` | 429 | Yes | Upstream quota exhausted or Curio rate limiter reached. |
| `PROVIDER_UNAVAILABLE` | 503 | Yes | Upstream API is down, experiencing an outage, or overloaded. |
| `INVALID_ARGUMENT` | 400 | No | Malformed payload, missing selection text, or oversized request (>15KB). |
| `CANCELLED` | 499 | No | The client closed the overlay or clicked Stop. |
| `NETWORK_ERROR` | N/A | Yes | Socket disconnect or timeout connecting to provider. |
| `PROVIDER_ERROR` | 502 | Yes | Generic upstream LLM generation failure. |

---

## 2. The Failover Invariant

Curio implements an intelligent **Pre-Stream Failover** rule:

```
                  ┌────────────────────────┐
                  │ Primary Provider Call  │
                  └───────────┬────────────┘
                              │
                    Did an error occur?
                   /                  \
                 Yes                   No
                 /                       \
      Has any delta been emitted?     Stream deltas normally
             /             \
        [deltaCount === 0]   [deltaCount > 0]
           /                    \
   Failover to Secondary     DO NOT FAILOVER
   (Seamless recovery)       (Emit event: error)
```

### Why Mid-Stream Failover is Strictly Barred:
If 50 words have already been streamed to the user's screen from Gemini, and Gemini crashes, switching to Groq/Llama would cause:
- A sudden change in tone, formatting, and vocabulary
- Repetition of previous thoughts
- Contradictory explanations
- Visual corruption in syntax blocks

Therefore, **failover is strictly permitted only when `deltaCount === 0`**. If an error happens mid-stream, Curio terminates the stream cleanly with `event: error` and gives the user an explicit **Retry** button.

---

## 3. Client UI Recovery States

In `FloatingOverlay.jsx`, the user experience gracefully adapts:

1. **Active Streaming State**:
   - Shows progressive text rendering
   - Provides a prominent **Stop** button
2. **Error State**:
   - Displays a red badge with the error summary
   - Hides the spinner
   - Renders a **Retry** button allowing one-click re-invocation
3. **Cancelled State**:
   - Freezes the partial text received so far
   - Re-enables the follow-up input and depth controls without showing an error banner

---

## 4. Edge Validation & Rate Limiting

1. **Payload Size Guard**:
   `ExplainStreamSchema` rejects `selectedText` greater than 15,000 characters and `followUp` queries greater than 1,000 characters.
2. **Rate Limiter**:
   - General API: 120 requests / 15 minutes per IP
   - AI Stream Endpoints: 60 requests / 15 minutes per IP
   - Exceeding the limit returns an immediate JSON `429 Too Many Requests` or SSE `event: error` with code `RATE_LIMITED`.

