# Changelog

All notable changes to SuperClaw Pure are documented here.

## [0.1.0] — 2026-03-12

### 🎉 Initial Release

#### Core Engine
- Native LLM streaming via `chat-engine.ts` — OpenAI-compatible + Anthropic protocols
- `ProviderRouter.chatWithFallback()` — multi-provider routing with automatic fallback
- Quality-aware model routing — 50+ models scored 0-100, quality floors per system task
- Smart 3-tier routing — heartbeat/greeting/chat/complex classification
- Circuit breaker — 3 consecutive failures → 30min provider cooldown
- Loop detection — Jaccard similarity >0.85 prevents infinite loops

#### Memory (Eidetic Memory Layer)
- 5-layer architecture: Core → Buffer → Working → Graph → Archival
- Agent memory with 10 types: short_term, long_term, entity, preference, fact, decision, goal, event, procedure, correction
- Knowledge graph with 6 edge relations: related_to, updates, contradicts, supports, caused_by, part_of
- FTS5 full-text search on chat history (`porter unicode61 remove_diacritics 2`)
- Working memory — structured task state persisted across compactions
- Core memory blocks — agent-editable identity/persona/project notes
- Episodes — non-lossy event log with timestamps
- LLM-powered compaction with heuristic fallback
- Background fact extraction from conversations
- Budget-aware context injection (token budgets per layer)
- Bi-temporal model — `event_at` / `valid_until` for temporal reasoning

#### Security (Score: 7.3/10)
- Workspace sandbox — `validateToolPath()` restricts file operations
- Global auth middleware — API key in production, owner fallback for self-hosted
- Command blocking — 25+ dangerous shell patterns (rm -rf, env vars, sudo, etc.)
- Security headers — CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- SSE connection limits — max 50 concurrent streams
- Path traversal protection — `guardPath()` blocks `..` in file operations

#### Agents
- Multi-agent with custom personas, system prompts, and skills
- Agent-specific memory — each agent maintains its own knowledge graph
- Public chat — shareable links for guest access to agents

#### Channels (Batch 7)
- Telegram Bot API — send/receive via webhook
- Discord Webhook — outbound messages
- Slack Webhook — outbound messages + event subscription
- Generic Webhook — configurable URL/method/secret
- Channel message history with direction tracking
- Config masking — bot tokens never exposed in API responses

#### Skill Hub (Batch 7.5)
- 18 curated, audited skills across 9 categories
- Categories: productivity, coding, search, communication, data, automation, creative, utilities
- Verification badges — all skills security-scored ≥ 8.5/10
- Marketplace API — browse, search, install, rate

#### Dashboard & Analytics
- 3-tab dashboard: Overview / Usage / Health
- 5 analytics endpoints: overview, usage-by-model, usage-by-agent, daily-stats, health
- Token usage tracking per session/agent/model
- Cost estimation with 38 model pricing entries

#### Infrastructure
- Docker support — multi-stage build, docker-compose, health checks
- SQLite database — zero-config, single-file persistence
- Pricing externalized to `config/pricing.ts` — 38 models, provider fallbacks
- Configuration defaults in `config/defaults.ts` — single source of truth
- 118 tests across 9 test files

#### Frontend
- WhatsApp-style mobile experience (`MobileApp.tsx`)
- Desktop chat + right sidebar (Code / Preview / Browser / Tasks / Automations)
- Kanban board for task management
- Settings UI with provider, agent, and channel configuration
- Setup wizard for first-run experience
- Service Worker with build-stamped versioning
