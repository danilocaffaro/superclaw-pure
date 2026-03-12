# ─── Stage 1: base ────────────────────────────────────────────────────────────
FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# ─── Stage 2: deps ────────────────────────────────────────────────────────────
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

# ─── Stage 3: build ───────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
RUN pnpm run build

# ─── Stage 4: production ──────────────────────────────────────────────────────
FROM node:22-slim AS production
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# Copy installed node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy built artifacts
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/packages/shared/dist ./packages/shared/dist

# Copy package manifests (needed by Node module resolution)
COPY --from=build /app/apps/server/package.json ./apps/server/
COPY --from=build /app/apps/web/package.json ./apps/web/
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/package.json ./

ENV NODE_ENV=production
ENV SUPERCLAW_PORT=4070
ENV NEXT_PORT=3000

EXPOSE 4070 3000

# Run API server and Next.js frontend concurrently
CMD ["sh", "-c", "cd apps/server && node dist/index.js & cd apps/web && npx next start -p $NEXT_PORT & wait"]
