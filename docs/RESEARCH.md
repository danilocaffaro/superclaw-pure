# SuperClaw Pure — Research & Strategic Analysis

## 1. Plano Existente (Resgate)

### Decisões já tomadas:
- SuperClaw Pure = novo repo, engine própria, sem dependência do Bridge/OpenClaw
- User-agnostic: nasce virgem, sem agentes embebidos
- Setup wizard user-friendly, passo a passo
- Dois SKUs: "SuperClaw OpenClaw Inside" (companion) e "SuperClaw Pure" (standalone)
- Tech: Next.js SPA + Fastify + SQLite (monorepo provado em 57 sprints)
- Cloudflare Tunnel + caffaro.dev para deploy
- Multi-gateway architecture confirmada (BridgePool pattern)

### Assets reutilizáveis do SuperClaw atual:
- UI/UX inteira (sidebar, chat, right panel, mobile stack, settings)
- Agent CRUD, squad management, @mention routing
- Public chat / shared links
- Gateway pairing system
- Preview panel com device chrome
- Browser panel com Playwright real
- Task/Kanban system

---

## 2. Pesquisa: Dores e Demandas dos Usuários

### Fontes: Reddit r/openclaw, GitHub issues, posts de heavy users

#### 🔴 Dores Críticas (reportadas repetidamente)

| # | Dor | Fonte | Frequência |
|---|-----|-------|-----------|
| D1 | **Setup infernal** — "first 72 hours determine if you keep using it" | Multiple posts | ⭐⭐⭐⭐⭐ |
| D2 | **Context window management** — "starts getting senile at 200K", compaction perde contexto | 2-month heavy user | ⭐⭐⭐⭐⭐ |
| D3 | **Agent loops** — repete a mesma resposta 8x sem progress | Tip posts | ⭐⭐⭐⭐ |
| D4 | **Token burn** — heartbeats/cron consumindo modelo caro desnecessariamente | Multiple | ⭐⭐⭐⭐ |
| D5 | **Memory persistence** — sessions are stateful only while open; close = forget | 72h guide | ⭐⭐⭐⭐ |
| D6 | **Security concerns** — prompt injection via web scraping, API key leaks | Security posts | ⭐⭐⭐⭐ |
| D7 | **"Vibe-coded" perception** — code quality concerns, "big piece of software" | Comparison post | ⭐⭐⭐ |
| D8 | **UI/UX nightmare** — "WhatsApp/Discord slash commands are a UX nightmare" | BotsChat builder | ⭐⭐⭐ |
| D9 | **No good web dashboard** — "everyone's first instinct is to build a dashboard" but OpenClaw doesn't have one | 72h guide | ⭐⭐⭐ |
| D10 | **Overnight work doesn't work** — "ask agent to work, close chat, it forgets" | Multiple | ⭐⭐⭐ |

#### 🟡 Demandas de Features

| # | Feature | Demanda |
|---|---------|---------|
| F1 | **Smart model routing** — automatic cheap/expensive based on task complexity | High |
| F2 | **Persistent background tasks** — queue-based, survives session close | High |
| F3 | **Better memory** — structured, graph-based, not just markdown files | High |
| F4 | **Usage dashboard** — cost tracking, token usage, activity heatmaps | Medium |
| F5 | **One-click deploy** — not 2 days of config before useful | High |
| F6 | **Multi-channel from web UI** — stop depending on Telegram/WhatsApp as primary | Medium |
| F7 | **Parallel agent execution** — coordinate 5-20 workers simultaneously | High |
| F8 | **Approval workflows** — sandboxed execution, human-in-the-loop | Medium |
| F9 | **Playbook system** — capture what works, auto-promote to skills | Medium |
| F10 | **Build mode** — idea → prototype phased workflow | Medium |

#### 💚 O Que Funciona Bem no OpenClaw (manter/melhorar)

| # | Ponto Forte |
|---|------------|
| S1 | Browser automation — "killer feature" |
| S2 | Multi-channel (WhatsApp, Telegram, Discord, Slack) |
| S3 | Self-evolving skills system |
| S4 | Tool use com Anthropic models |
| S5 | Cron/heartbeat system |
| S6 | "Colleague" mental model — own GitHub, Twitter, accounts |
| S7 | Governed agents > always-on agents |

---

## 3. Análise de Concorrentes

### CoWork-OS (MIT, Electron desktop app)
**Stars:** Growing fast, mencionado como superior ao OpenClaw

**Pontos fortes:**
- 30+ LLM providers, 15 channels, 139 skills out-of-box
- "Digital Twin Personas" — pre-built roles (engineer, PM, manager)
- "Zero-Human Company Ops" — founder-directed autonomous company
- Plugin Platform com 17 role-specific packs + Plugin Store
- Active Context sidebar — always-visible MCP connectors
- Build Mode — Concept → Plan → Scaffold → Iterate
- AI Playbook — auto-captures what works → auto-promotes to skills
- Evolving Intelligence — 6 memory subsystems merged
- Usage Insights dashboard (cost/token tracking, heatmaps)
- ChatGPT History Import (migrate existing context)
- 3200+ tests, security-first
- **Setup: npm install -g cowork-os && cowork-os** ← one command

**Fraquezas:**
- Electron only (no pure web), heavy desktop footprint
- Feature creep potential (too many features)
- New project, less battle-tested

### Spacebot (FSL License, Rust, by Spacedrive team)
**Stars:** 1.7K, growing

**Pontos fortes:**
- **Rust** — single binary, no Docker, no dependencies
- **Concurrent by design** — thinks, executes, responds simultaneously
- **Multi-user native** — Discord communities with 50+ concurrent users
- **Message coalescing** — batches rapid-fire messages, "reads the room"
- **Typed memory graph** — 8 memory types (Fact, Preference, Decision, Goal, Todo...) with edges (RelatedTo, Updates, Contradicts)
- **Smart routing** — 4-level: process-type → task-type → prompt complexity → fallback
- **OpenCode integration** — full coding agent as persistent worker
- **Cron with circuit breaker** — auto-disables after 3 failures
- **Skills.sh ecosystem** + OpenClaw skill compatibility
- **One-click deploy** via spacebot.sh (hosted option)
- **Active hours** for cron — restrict to time windows

**Fraquezas:**
- Rust = harder to contribute for average developer
- Newer, less ecosystem
- FSL license (not pure open source)

### PicoClaw (Apache 2.0, Go, by Sipeed)
**Stars:** 24K (0→12K in 1 week!), `sipeed/picoclaw`
**Formerly:** Moltbot → Clawdbot → PicoClaw

**Pontos fortes:**
- **Go single binary** — <10MB RAM, 1s boot on 0.6GHz single core
- **$10 hardware** — runs on LicheeRV-Nano, Raspberry Pi Zero, old Android phones via Termux
- **Multi-arch** — RISC-V, ARM, MIPS, x86 (tudo cross-compiled)
- **AI-bootstrapped** — 95% do código gerado pelo próprio agente com human-in-the-loop
- **`picoclaw onboard` wizard** — guided first-run, similar ao que queremos
- **model_list config** — zero-code provider addition, format simples
- **5 chat channels** — Telegram, Discord, QQ, DingTalk, LINE
- **Web launcher** — browser UI at :18800 (Docker compose)
- **Workspace sandboxing** — `restrict_to_workspace: true` bloqueia acesso fora do workspace
- **Dangerous command blocking** — `rm -rf`, `format`, `dd`, fork bomb automaticamente bloqueados
- **Heartbeat system** — HEARTBEAT.md checked every 30min (idêntico ao OpenClaw)
- **Subagent spawn** — long tasks spawned async, non-blocking heartbeat
- **Agent Social Network** — ClawdChat.ai para agentes se conectarem entre si
- **5 web search providers** — Brave, Tavily, DuckDuckGo, Perplexity, SearXNG (self-hosted)
- **Docker support** — docker-compose com profiles (gateway, launcher, agent)
- **Old phone revival** — marketing genial: "Give your decade-old phone a second life!"

**Fraquezas:**
- CLI-only (web launcher é básico, não tem dashboard/UI rica)
- Sem multi-agent/squads nativo
- Sem usage dashboard/cost tracking
- Sem memory graph (usa MEMORY.md flat file como OpenClaw)
- Security warning: "may have unresolved network security issues"
- Crescimento explosivo = muitos PRs, poucos maintainers

**O que absorver para SuperClaw Pure:**
1. **Onboard wizard** (`picoclaw onboard`) — inspiração direta para nosso Setup Wizard
2. **model_list format** — config simples sem código
3. **Workspace sandboxing** — `restrict_to_workspace` + dangerous command blocking
4. **Multi-search fallback** — cascata Brave → Tavily → DuckDuckGo
5. **Docker compose profiles** — deploy facilitado
6. **Subagent spawn pattern** — non-blocking async tasks

---

## 4. Inspiração: Wolf-Server (Proprietary Origin)

**wolf-server** é o Go binary proprietário (14MB, auto-contido) que foi o engine original do SuperClaw — originário do HubAI Nitro / PicPay. SuperClaw já é o clean-room TypeScript rewrite dele.

### O que aprendemos com Wolf (para levar ao Pure):
- **12 built-in tools** — bash, edit, glob, grep, read, write, webfetch, task, todo, memory, plans, question
- **40 endpoints REST** bem definidos (sessions, messages, memory, plans, skills, MCP, plugins, heartbeat)
- **SQLite como DB principal** com WAL mode — single-file, zero config
- **Plugin system** (`window.wolf` sandbox) com lifecycle hooks
- **SSE streaming** para respostas em tempo real (8 event types)
- **Port 4070** como padrão
- **`~/.superclaw/`** como diretório de dados (separado do `~/.wolf/` proprietário)

### Lições dos 57 sprints de SuperClaw:
1. **Bridge pattern funciona** — abstrair o engine permite trocar backends sem mudar UI
2. **SQLite > markdown files** para memória e planos — buscável, transacional
3. **BridgePool multi-gateway** permite conectar agentes de múltiplas máquinas
4. **ARCHER v2 @mention routing como code** + NEXUS v3 tags como prompt = melhor combo
5. **Setup wizard é essencial** — sem ele, 80% dos users desistem nos primeiros 3 dias
6. **Service Worker caching** causa mais problemas do que resolve — precisa de stamp versionado

---

## 5. Matriz de Comparação

| Aspecto | OpenClaw | CoWork-OS | Spacebot | PicoClaw | **SuperClaw Pure** |
|---------|---------|-----------|----------|----------|-------------------|
| **Linguagem** | TypeScript | TypeScript/Electron | Rust | Go | **TypeScript** |
| **Stars** | 145K+ | Growing | 1.7K | 24K | **New** |
| **Deploy** | `npm i -g` + 30min | `npm i -g` + works | Binary/hosted | Binary + onboard | **npx + Wizard** |
| **Time-to-value** | 2-3 dias | ~30 min | ~10 min | ~2 min | **< 5 min** |
| **UI** | CLI + channels | Electron desktop | Discord/Slack/Web | CLI (basic web) | **Web-first SPA** |
| **Channels** | 9 | 15 | 5 | 5 (TG/Discord/QQ/DingTalk/LINE) | **Web + plugins** |
| **LLM Providers** | ~15 | 30+ | ~10 | model_list (any) | **Universal adapter** |
| **Memory** | Markdown flat | 6 subsystems | Typed graph | MEMORY.md flat | **Graph + vector** |
| **Concurrency** | Single-thread | Multi-agent | True concurrent | Subagent spawn | **Worker pool** |
| **Model routing** | Manual | Auto per provider | 4-level auto | Manual | **3-tier auto** |
| **Background** | Cron/heartbeat | Autonomous | Cron + breaker | Heartbeat + spawn | **Job queue + cron** |
| **Security** | Basic sandbox | 3200+ tests | Configurable | Workspace sandbox + cmd block | **Approval + sandbox** |
| **Setup** | Edit JSON | Works OOB | Config/hosted | `picoclaw onboard` | **Guided wizard** |
| **Extensibility** | ClawHub | Plugin Store | skills.sh + MCP | Skills dir | **Store + MCP** |
| **Usage tracking** | None | Dashboard | None | None | **Analytics** |
| **RAM** | >1GB | Heavy (Electron) | ~50MB | <10MB | **~100-200MB** |
| **License** | Apache 2.0 | MIT | FSL | Apache 2.0 | **MIT** |
| **Multi-user** | No | No | Yes (communities) | No | **v2** |
| **Hardware** | Mac/PC | Mac/PC | Mac/PC/Linux | $10 boards! | **Any Node.js** |

---

## 6. Pilares Arquiteturais do SuperClaw Pure

### 6.1 Core Principles
1. **Zero-config start** — `npx superclaw` → browser opens → setup wizard → chatting in < 5 min
2. **User-agnostic** — nasce virgem, sem agentes, sem config hardcoded
3. **Web-first** — SPA servida pelo próprio server (PWA mobile ready)
4. **Engine própria** — LLM routing direto, sem dependência de OpenClaw
5. **Typed memory** — structured graph + vector search + full-text
6. **Governed execution** — approval gates, sandboxed tools, circuit breakers
7. **Observable** — usage dashboard, cost tracking, session timeline

### 6.2 Tech Stack
- **Runtime:** Node.js + TypeScript (contribuição fácil, ecossistema rico)
- **Server:** Fastify (provado em 57 sprints)
- **Frontend:** Next.js static export (SPA, PWA)
- **DB:** SQLite (better-sqlite3) + SQLite vec extension (embeddings)
- **LLM:** Universal adapter (OpenAI-compatible + Anthropic + Ollama native)
- **Desktop:** Electron (optional, web é primary)

### 6.3 Module Map
```
superclaw-pure/
├── packages/
│   ├── core/              ← Engine: LLM routing, memory, tools, sessions
│   │   ├── llm/           ← Multi-provider adapter + smart routing
│   │   ├── memory/        ← Typed graph + vector + full-text
│   │   ├── tools/         ← Sandboxed tool execution + MCP client
│   │   ├── sessions/      ← Session lifecycle + persistence
│   │   └── skills/        ← Skill loader + registry client
│   ├── server/            ← Fastify API + WebSocket + SSE
│   ├── web/               ← Next.js SPA (chat, dashboard, settings)
│   └── cli/               ← npx superclaw (start, config, doctor)
├── skills/                ← Bundled starter skills
├── docs/
└── tests/
```
