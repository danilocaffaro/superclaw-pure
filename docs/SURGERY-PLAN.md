# Surgery Plan: SuperClaw OpenClaw-Inside → SuperClaw Pure

## Phase 1: Remove Bridge Layer (server)

### DELETE these files:
- `bridge/openclaw-bridge.ts` — WebSocket client to OpenClaw gateway
- `bridge/bridge-pool.ts` — Multi-gateway BridgePool
- `api/bridge-proxy.ts` — Proxy routes to Bridge
- `api/sessions-bridge.ts` — Session management via Bridge (replace with native)
- `api/agents-bridge.ts` — Agent management via Bridge (replace with native agents.ts)
- `api/gateways.ts` — Gateway CRUD (no more external gateways)
- `api/agent-gateway.ts` — External agent pairing (defer to v2)
- `db/gateways.ts` — Gateway DB repository

### KEEP as-is:
- `api/squads.ts` — Squad CRUD
- `api/backlog.ts` — Kanban/tasks
- `api/auth.ts` — Auth + audit
- `api/browser.ts` — Playwright browser
- `api/files.ts` — File serving
- `api/mcp.ts` — MCP client
- `api/memory.ts` — Agent memory
- `api/config.ts` — Config CRUD (remove bridge refs)
- `api/public-chat.ts` — Public chat (rewire from bridge to native engine)
- `api/providers.ts` — Provider management
- `api/artifacts.ts`, `api/tasks.ts`, `api/marketplace.ts`, etc.
- `engine/archer-router.ts` — ARCHER v2 routing
- `engine/nexus-templates.ts` — NEXUS v3 tags
- `engine/browser-pool.ts` — Playwright pool
- `engine/mcp-client.ts` — MCP client
- `engine/squad-runner.ts` — Squad orchestration
- `engine/tools/*` — All tools
- `db/` — All DB repos (except gateways)

### REWRITE:
- `index.ts` — Remove bridge init, simplify startup
- `api/sse.ts` — Remove bridge dependency, use native engine events
- `api/sessions.ts` — Enable as primary session handler (was disabled)
- `api/agents.ts` — Enable as primary agent handler (was disabled)
- `engine/squad-bridge-runner.ts` → `engine/squad-runner.ts` — Route via native engine not bridge
- `api/setup.ts` — Enhance with wizard flow
- `api/public-chat.ts` — Route via native engine not bridge

### ADD:
- `engine/chat-engine.ts` — Native LLM adapter (OpenAI + Anthropic + Ollama + Google)
- `engine/native-session-runner.ts` — Direct LLM streaming without Bridge

## Phase 2: Clean Frontend (web)

### Minimal changes needed:
- Stores already call REST APIs — they don't know about Bridge
- Remove GatewaysTab from settings (or repurpose)
- Setup wizard already exists — enhance for virgin flow
- Agent store: remove bridge-specific fields

## Phase 3: Config/Build

### Update:
- `package.json` — Remove ws dependency, add openai SDK
- `tsconfig.json` — Ensure paths work
- Root `package.json` — Updated workspace config
