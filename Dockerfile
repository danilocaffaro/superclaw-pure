# SuperClaw Pure — Multi-stage Docker build
# Usage:
#   docker build -t superclaw-pure .
#   docker run -p 4070:4070 -v superclaw-data:/data superclaw-pure

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN npm ci --ignore-scripts

# Copy source
COPY apps/server ./apps/server
COPY apps/web ./apps/web

# Build server
WORKDIR /app/apps/server
RUN npx tsc

# Build frontend
WORKDIR /app/apps/web
ENV NEXT_OUTPUT=export
RUN npx next build
# SW stamp
RUN node -e "const fs=require('fs');const ts=Date.now();const f='public/sw.js';if(fs.existsSync(f)){let c=fs.readFileSync(f,'utf8');c=c.replace(/v[0-9]+/,'v'+ts);fs.writeFileSync('out/sw.js',c);console.log('SW stamped',ts)}"

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# Security: non-root user
RUN addgroup -S superclaw && adduser -S superclaw -G superclaw

# Copy built artifacts
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/web/out ./apps/web/out

# Copy root package for workspaces
COPY package.json ./

# Install production dependencies only
COPY apps/server/package.json ./apps/server/
WORKDIR /app/apps/server
RUN npm install --omit=dev --ignore-scripts 2>/dev/null || true

WORKDIR /app

# Data volume for SQLite
RUN mkdir -p /data && chown superclaw:superclaw /data
VOLUME ["/data"]

# Workspace for agents
RUN mkdir -p /workspace && chown superclaw:superclaw /workspace
VOLUME ["/workspace"]

# Environment
ENV NODE_ENV=production
ENV PORT=4070
ENV HOST=0.0.0.0
ENV SUPERCLAW_DB_PATH=/data/superclaw.db
ENV SUPERCLAW_WEB_DIR=/app/apps/web/out
ENV SUPERCLAW_WORKSPACE=/workspace

# Switch to non-root
USER superclaw

EXPOSE 4070

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:4070/api/health || exit 1

CMD ["node", "apps/server/dist/index.js"]
