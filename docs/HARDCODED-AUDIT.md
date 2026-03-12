# HARDCODED AUDIT — SuperClaw Pure

**Date:** 2026-03-12
**Scope:** `apps/server/src/` + `apps/web/src/`
**Severity:** 🔴 Critical | 🟡 Medium | 🟢 Low (cosmetic/acceptable)

---

## 🔴 CRITICAL — Must fix before v1.0

### HC-001: Hardcoded port fallback in multiple files
| File | Line | Value | Fix |
|------|------|-------|-----|
| `index.ts` | 62 | `4070` | ✅ Already uses `PORT` env — fallback OK |
| `index.ts` | 149-151 | `localhost:4080, :3000, 127.0.0.1:4080` | Move to `SUPERCLAW_CORS_ORIGINS` env |

### HC-002: Hardcoded provider base URLs scattered everywhere
| File | Lines | Values |
|------|-------|--------|
| `db/providers.ts` | 136 | `http://localhost:11434` |
| `api/setup.ts` | 73, 278 | `http://localhost:11434`, `https://api.anthropic.com`, `https://api.openai.com` |
| `api/providers.ts` | 35, 49, 59, 208 | `https://api.anthropic.com`, `https://api.openai.com`, `http://localhost:11434` |
| `engine/native-session-runner.ts` | 41-43 | `PROVIDER_BASE_URLS` map |
| `engine/providers/index.ts` | 97-99 | `https://api.anthropic.com`, `https://api.openai.com` |
| `engine/providers/ollama.ts` | 12, 19 | `http://localhost:11434` |

**Fix:** Create `config/defaults.ts` with `PROVIDER_DEFAULTS` map. All files import from there. Ollama default URL is OK as a default but must be overridable from DB.

### HC-003: Hardcoded model names as fallbacks
| File | Lines | Values |
|------|-------|--------|
| `api/sessions.ts` | 48, 51, 57 | `claude-opus-4-20250918` |
| `api/setup.ts` | 40, 60 | `claude-sonnet-4-5-20250514`, `gpt-4o-mini` |
| `api/agents.ts` | 175 | `gpt-4o` |
| `engine/native-session-runner.ts` | 78 | `gpt-4o` |
| `engine/providers/index.ts` | 97, 153, 157 | `gpt-4o`, `claude-sonnet-4-5-*`, `claude-haiku-4-5-*` |

**Fix:** Default model = first available from configured provider. No hardcoded model name. Create `getDefaultModel(providerId)` that queries DB.

### HC-004: Hardcoded model pricing table
| File | Lines | Values |
|------|-------|--------|
| `engine/agent-runner.ts` | 120-182 | 15+ model prices hardcoded |

**Fix:** Move to `config/pricing.ts` or fetch from provider API. Allow user override via DB `model_pricing` table.

### HC-005: Frontend hardcoded model/provider lists
| File | Lines | Values |
|------|-------|--------|
| `stores/ui-store.ts` | 92 | `copilot/claude-opus-4.6` default |
| `components/settings/ModelsTab.tsx` | 22-37 | 3 hardcoded fallback models |
| `components/ModelSelector.tsx` | 22-23 | `copilot/claude-opus-4.6` fallback |
| `components/chat/ToolChipsBar.tsx` | 29 | "Claude Opus 4" label |
| `components/SetupWizard.tsx` | 325-327, 637 | Provider descriptions, model IDs |

**Fix:** All model lists come from `/api/config/providers` endpoint. Frontend stores fetch on init. No fallback model arrays in frontend code.

---

## 🟡 MEDIUM — Fix in polish sprint

### HC-006: Bridge/OpenClaw remnants in frontend
| File | Values |
|------|--------|
| `DeploysTab.tsx:64` | Shows `bridgeUrl` |
| `GatewaysTab.tsx` | Entire file (already removed from nav, file should be deleted) |
| `SetupWizard.tsx:560` | "OpenClaw" mention |
| `MemoryPanel.tsx:5` | `http://localhost:4070` |

**Fix:** Delete GatewaysTab.tsx, clean DeploysTab, remove OpenClaw refs from SetupWizard.

### HC-007: Frontend API_BASE hardcoded
| File | Lines | Values |
|------|-------|--------|
| `MemoryPanel.tsx` | 5 | `http://localhost:4070` |
| `right-panel/PreviewPanel.tsx` | 90 | `http://localhost:3000` default |
| `right-panel/FlowsPanel.tsx` | 234 | `http://localhost:5678` |

**Fix:** All API calls use relative URLs (`/api/...`). External URLs (n8n, preview) should be user-configurable, not hardcoded.

### HC-008: CORS origins hardcoded
| File | Lines | Values |
|------|-------|--------|
| `index.ts` | 149-151 | `localhost:4080`, `localhost:3000`, `127.0.0.1:4080` |

**Fix:** Already supports `SUPERCLAW_CORS_ORIGINS` env var. Remove hardcoded fallbacks — use `*` in dev, env var in production.

---

## 🟢 LOW — Acceptable with documentation

### HC-009: Tool limits (MAX_CHARS, MAX_LOG_LINES, etc.)
Reasonable defaults for safety. Document in config but keep as constants.

### HC-010: Schema defaults (tunnel_host `127.0.0.1`)
Database schema defaults are fine — they're overridable per-row.

### HC-011: "SuperClaw" branding in error messages/comments
Brand name in the product is expected. No fix needed.

---

## Fix Plan — Priority Order

1. **`config/defaults.ts`** — Central source of truth for all defaults
   - `DEFAULT_PROVIDER_URLS`: Map of provider → base URL
   - `DEFAULT_FALLBACK_MODEL`: Function, not string (queries DB)
   - `DEFAULT_PORT`, `DEFAULT_HOST`
   - `CORS_DEV_ORIGINS`

2. **All server files import from `config/defaults.ts`** — replace scattered literals

3. **Frontend: fetch-first, no fallback arrays** — models/providers from API only

4. **Delete dead files** — GatewaysTab.tsx, clean Bridge references

---

## Counts
| Severity | Items | Files Affected |
|----------|-------|----------------|
| 🔴 Critical | 5 | 14 server + 6 frontend |
| 🟡 Medium | 3 | 5 frontend |
| 🟢 Low | 3 | — (acceptable) |
| **Total** | **11** | **~25 files** |
