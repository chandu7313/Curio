# Curio — AI Provider Integration Guide

This guide details the integration mechanics for Curio's supported LLM providers: **Google Gemini API** and **Groq Cloud API**.

---

## 1. Supported Providers & Models

| Provider | Default Model | Upstream API Protocol | Auth Header / Query |
| :--- | :--- | :--- | :--- |
| **Google Gemini** | `gemini-2.0-flash` | REST SSE (`streamGenerateContent?alt=sse`) | Query param `key=${API_KEY}` |
| **Groq Cloud** | `llama-3.3-70b-versatile` | OpenAI-compatible SSE (`/v1/chat/completions`) | `Authorization: Bearer ${API_KEY}` |

---

## 2. Google Gemini API Integration

### 2.1. Request Endpoint & Headers
```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={API_KEY}
Content-Type: application/json
```

### 2.2. Request Payload
```json
{
  "systemInstruction": {
    "parts": [{ "text": "System instructions here..." }]
  },
  "contents": [
    {
      "role": "user",
      "parts": [{ "text": "User prompt including isolated text..." }]
    }
  ],
  "generationConfig": {
    "temperature": 0.4,
    "maxOutputTokens": 2048,
    "topP": 0.95
  },
  "safetySettings": [
    { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE" },
    { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE" },
    { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE" }
  ]
}
```

### 2.3. Streaming Protocol
Gemini returns native Server-Sent Events when `alt=sse` is passed in the query string.
Each event payload contains:
```
data: {"candidates":[{"content":{"parts":[{"text":"chunk..."}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":15,"candidatesTokenCount":42}}
```

### 2.4. Error Normalization
- HTTP `400`: `INVALID_ARGUMENT` (non-retryable)
- HTTP `401` / `403`: `AUTHENTICATION_ERROR` (invalid or expired Gemini API key)
- HTTP `429`: `RATE_LIMITED` (upstream quota exhausted; retryable)
- HTTP `503`: `PROVIDER_UNAVAILABLE` (Gemini service overload; triggers failover)
- `AbortError`: `CANCELLED` (client disconnected)

---

## 3. Groq Cloud API Integration

### 3.1. Request Endpoint & Headers
```
POST https://api.groq.com/openai/v1/chat/completions
Content-Type: application/json
Authorization: Bearer {GROQ_API_KEY}
```

### 3.2. Request Payload
```json
{
  "model": "llama-3.3-70b-versatile",
  "messages": [
    { "role": "system", "content": "System instructions here..." },
    { "role": "user", "content": "User prompt including isolated text..." }
  ],
  "stream": true,
  "temperature": 0.4,
  "max_tokens": 2048
}
```

### 3.3. Streaming Protocol
Groq returns standard OpenAI-compatible chunks:
```
data: {"id":"chatcmpl-123","choices":[{"index":0,"delta":{"content":"chunk..."},"finish_reason":null}]}
```
When generation completes, Groq sends:
```
data: [DONE]
```

### 3.4. Error Normalization
- HTTP `401`: `AUTHENTICATION_ERROR` (invalid Groq API key)
- HTTP `429`: `RATE_LIMITED` (Groq rate limit reached; retryable)
- HTTP `503`: `PROVIDER_UNAVAILABLE` (Groq API down or overloaded)
- `AbortError`: `CANCELLED` (client stopped streaming)

---

## 4. Environment Configuration

Configuration is managed via `.env` in the repository root or `backend/.env`.

```bash
# Server Port & Mode
PORT=5000
NODE_ENV=development

# AI Provider Settings
DEFAULT_AI_PROVIDER=gemini        # 'gemini' | 'groq'
ENABLE_PROVIDER_FAILOVER=true     # Automatically fall back if primary is unconfigured or fails

# Google Gemini API Credentials
GEMINI_API_KEY=AIzaSyYourActualKeyHere
GEMINI_MODEL=gemini-2.0-flash

# Groq Cloud API Credentials
GROQ_API_KEY=gsk_YourActualGroqKeyHere
GROQ_MODEL=llama-3.3-70b-versatile

# CORS (Frontend origins permitted)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:5000
```

---

## 5. Adding New Providers

The AI Provider Factory allows adding new providers without touching existing routing or UI logic:

1. Create a new provider class under `backend/src/services/ai/providers/yourProvider.js`:
```javascript
export class YourProvider {
  constructor(options = {}) {
    this.name = 'your_provider';
    this.model = options.model || 'model-id';
    this.apiKey = options.apiKey || process.env.YOUR_API_KEY;
  }

  isAvailable() {
    return Boolean(this.apiKey && !this.apiKey.startsWith('your_'));
  }

  async streamExplanation(options, onDelta, signal) {
    // 1. Dispatch HTTP request with signal
    // 2. Parse response stream
    // 3. Invoke onDelta(textChunk)
    // 4. Return usage metadata
    return { usage: { totalTokens: 100 } };
  }

  normalizeError(err) {
    return {
      code: 'PROVIDER_ERROR',
      message: err.message,
      retryable: true,
    };
  }
}
```

2. Register the provider in `backend/src/services/ai/aiProviderFactory.js`:
```javascript
import { YourProvider } from './providers/yourProvider.js';

// Inside registerBuiltInProviders()
this.registerProvider('your_provider', new YourProvider());
```

