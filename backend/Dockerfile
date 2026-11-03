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

# Run with dumb-init to handle SIGTERM/SIGINT signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "src/server.js"]

