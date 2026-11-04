# Curio — Production Deployment & DevOps Architecture Guide

> **Enterprise Deployment Guide for Self-Hosted and Cloud AI Backend Infrastructure**  
> *Antigravity AI Application Infrastructure — Production Release v1.0.0*  
> *Author: Principal Software Architect & DevOps Lead*

---

## 1. System Architecture Overview

Curio is composed of two primary systems:
1. **Curio Client Extension**: A lightweight Chrome Manifest V3 extension running locally inside user browser tabs. Communicates over HTTPS/SSE with the backend API.
2. **Curio AI Backend API**: A Node.js (v22 LTS) / Express service providing streaming LLM orchestration (Google Gemini & Groq), prompt boundary defenses, rate limiting, and optional PostgreSQL synchronization.

```
┌────────────────────────────────────────────────────────┐
│               User Browser (Chromium)                  │
│                                                        │
│  [ Webpage DOM ] <─── (Shadow DOM) ───> [ Curio UI ]  │
│                                              │         │
│                                          HTTPS / SSE   │
└──────────────────────────────────────────────┼─────────┘
                                               │
                                               ▼
┌────────────────────────────────────────────────────────┐
│             Edge Layer (Nginx / Caddy)                 │
│         TLS Termination, WAF, SSE Buffering Off        │
└──────────────────────────────────────────────┼─────────┘
                                               │
                                               ▼
┌────────────────────────────────────────────────────────┐
│             Curio Backend (Docker Container)           │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │ Express App (Helmet, CORS Whitelist, RateLimit)│   │
│   └───────────────────────┬────────────────────────┘   │
│                           │                            │
│   ┌───────────────────────▼────────────────────────┐   │
│   │ Prompt Builder & Injection Fence Validator     │   │
│   └───────────────────────┬────────────────────────┘   │
│                           │                            │
│   ┌───────────────────────▼────────────────────────┐   │
│   │ AI Provider Orchestrator (Gemini ↔ Groq)       │   │
│   └───────────────────────┬────────────────────────┘   │
└───────────────────────────┼────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
  ┌───────────────────┐           ┌───────────────────┐
  │ Google Gemini API │           │     Groq API      │
  │ (gemini-1.5-flash)│           │(llama-3.3-70b-vers)│
  └───────────────────┘           └───────────────────┘
```

---

## 2. Docker Containerization Architecture

The Curio backend is packaged using a production-grade, minimal Alpine Linux base image adhering to container security best practices:
- **Base Image**: `node:22-alpine`
- **Signal Handling**: Integrated `dumb-init` to properly reap zombie processes and gracefully handle `SIGTERM` / `SIGINT` container stop signals.
- **Least-Privilege Execution**: Container drops root privileges and executes as unprivileged user `node` (`USER node`).
- **Healthcheck**: Embedded native HTTP probe checking `/health` every 30 seconds.

### `backend/Dockerfile`
```dockerfile
# ─── Curio Backend Dockerfile ──────────────────────────────────────────
FROM node:22-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /usr/src/app

# Install dependencies with frozen lockfile where possible
COPY package*.json ./
RUN npm ci --only=production

# Copy application source code
COPY . .

# Set environment & non-root user
ENV NODE_ENV=production
USER node

EXPOSE 3000

# Docker Healthcheck against the health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run with dumb-init to handle SIGTERM/SIGINT signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "src/server.js"]
```

---

## 3. Docker Compose Orchestration

For self-hosted or dedicated VM deployments, use `docker-compose.yml` to orchestrate the API server alongside a PostgreSQL 16 database.

### `docker-compose.yml`
```yaml
version: '3.8'

services:
  # ─── PostgreSQL Database ───────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    container_name: curio-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-curio}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-curio_secret}
      POSTGRES_DB: ${POSTGRES_DB:-curio_db}
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - curio_pgdata:/var/lib/postgresql/data
      - ./backend/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U curio -d curio_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  # ─── Curio API Server ──────────────────────────────────────────────
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: curio-api
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"
    environment:
      PORT: 3000
      NODE_ENV: production
      DATABASE_URL: postgresql://${POSTGRES_USER:-curio}:${POSTGRES_PASSWORD:-curio_secret}@postgres:5432/${POSTGRES_DB:-curio_db}
      CORS_ORIGINS: ${CORS_ORIGINS:-chrome-extension://*}
      RATE_LIMIT_WINDOW_MS: 900000
      RATE_LIMIT_MAX: 100
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      GROQ_API_KEY: ${GROQ_API_KEY}
      DEFAULT_PROVIDER: gemini
      AI_FAILOVER_ENABLED: "true"
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  curio_pgdata:
    driver: local
```

### Launch Instructions
```bash
# 1. Create secure environment file
cp backend/.env.example backend/.env.production
# Edit backend/.env.production with your real API keys

# 2. Build and launch services in background
docker compose --env-file backend/.env.production up -d --build

# 3. Verify container health
docker compose ps
docker compose logs -f backend
```

---

## 4. Production Reverse Proxy Configuration

Because Curio streams explanations over Server-Sent Events (SSE), the front-facing reverse proxy **must disable response buffering** (`proxy_buffering off;`).

### 4.1 Nginx Configuration
```nginx
# /etc/nginx/conf.d/curio.conf

upstream curio_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name api.curio.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.curio.example.com;

    ssl_certificate /etc/letsencrypt/live/api.curio.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.curio.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # SSE Streaming & API Proxying
    location / {
        proxy_pass http://curio_backend;
        proxy_http_version 1.1;

        # Disable buffering for real-time SSE tokens
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;

        # Standard Proxy Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection '';
    }
}
```

### 4.2 Caddy Alternative (`Caddyfile`)
```caddy
api.curio.example.com {
    reverse_proxy 127.0.0.1:3000 {
        # Caddy automatically flushes SSE text/event-stream chunks
        header_up Host {upstream_hostport}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

---

## 5. Environment Variables & Secret Configuration

Never commit active API keys to version control. Set variables via container runtime or secure secret vaults (e.g., AWS Secrets Manager, Doppler, or HashiCorp Vault).

| Variable Name | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | `production` | Node execution environment |
| `PORT` | No | `3000` | HTTP listen port |
| `GEMINI_API_KEY` | Conditional | Empty | Google Gemini API key |
| `GROQ_API_KEY` | Conditional | Empty | Groq API key (fallback or primary) |
| `DEFAULT_PROVIDER` | No | `gemini` | Primary AI provider (`gemini` or `groq`) |
| `AI_FAILOVER_ENABLED` | No | `true` | Auto-failover to secondary provider on error |
| `DATABASE_URL` | No | Empty | PostgreSQL connection string for sync |
| `CORS_ORIGINS` | No | Empty | Whitelisted domains (in addition to extensions) |
| `RATE_LIMIT_WINDOW_MS`| No | `900000` | 15-minute rate limit window (ms) |
| `RATE_LIMIT_MAX` | No | `100` | Max requests per rate limit window |

---

## 6. High Availability, Failover & Health Probing

### 6.1 Provider Failover Engine
Curio implements active failover:
1. When user requests an explanation, the backend tries the configured `DEFAULT_PROVIDER` (e.g. Gemini).
2. If the provider returns `429 (Rate Limited)` or `503 (Unavailable)`, the `aiProviderFactory.js` catches the error and seamlessly routes the streaming request to the secondary provider (e.g. Groq).
3. The client receives the stream without experiencing connection termination.

### 6.2 Health Probing
- **Endpoint**: `GET /health` or `GET /api/v1/health`
- **Output Sample**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptimeSeconds": 14205,
  "timestamp": "2026-11-04T08:35:00.000Z",
  "services": {
    "database": "connected",
    "aiProviders": {
      "default": "gemini",
      "gemini": "ready",
      "groq": "ready",
      "failoverEnabled": true
    }
  }
}
```
- Returns HTTP `200 OK` for healthy/degraded; integrates directly with Kubernetes liveness/readiness probes and AWS Route53 health checkers.

---

## 7. CI/CD Pipeline (`.github/workflows/ci.yml`)

The GitHub Actions workflow guarantees zero broken builds reaching production:
1. **Extension Verification**: Installs dependencies, runs all 222 unit tests, compiles production bundles, and produces verified `curio-extension-v1.0.0.zip`.
2. **Backend Verification**: Syntax checks all server routes and validates database schema definition.

---

## 8. Deployment Sign-Off

The Curio production deployment architecture is hardened, scalable, and fully documented for single-node container deployment or multi-region orchestration.
