# Matriz Detalhada: OpenClaw vs SuperClaw Pure vs PicoClaw vs HubAI Nitro

**Atualizado:** 2026-03-11

---

## Contexto: Como se Relacionam

```
HubAI Nitro (PicPay, 2024-2025)
    │ engenharia reversa
    ▼
wolf-server (Go binary, proprietário)
    │ clean-room TypeScript rewrite
    ▼
SuperClaw v0.2 (57 sprints, OpenClaw Inside)
    │ fork + engine própria
    ▼
SuperClaw Pure (MIT, standalone)


OpenClaw (Anthropic, 2024+) ◀── inspiration ──▶ NanoBot (Python)
    │                                                │
    │ Go rewrite, AI-bootstrapped                    │
    ▼                                                ▼
PicoClaw (Sipeed, 24K⭐)                      PicoClaw-labs fork
```

---

## 1. Identidade & Posicionamento

| | **OpenClaw** | **SuperClaw Pure** | **PicoClaw** | **HubAI Nitro** |
|---|---|---|---|---|
| **Organização** | Anthropic (open source) | Caffaro (open source) | Sipeed (open source) | PicPay (proprietário) |
| **Repo** | github/openclaw | github/danilocaffaro/superclaw-pure | github/sipeed/picoclaw | Privado (internal tool) |
| **Stars** | 145K+ | Novo | 24K (0→12K em 1 semana) | N/A |
| **Licença** | Apache 2.0 | MIT | Apache 2.0 | Proprietária |
| **Posicionamento** | AI assistant framework | Web-first personal AI platform | Ultra-lightweight AI on any hardware | Internal dev tool (PicPay) |
| **Público** | Developers / power users | Qualquer pessoa (B2C) | IoT / edge / budget hardware | Devs PicPay internos |
| **Tagline** | "Your personal AI agent" | "Works out of the box" | "Tiny, Fast, Deployable anywhere" | "HubAI for developers" |

---

## 2. Arquitetura & Stack

| | **OpenClaw** | **SuperClaw Pure** | **PicoClaw** | **HubAI Nitro** |
|---|---|---|---|---|
| **Linguagem** | TypeScript (Node.js) | TypeScript (Node.js) | Go | Go (wolf) + TypeScript (Electron) |
| **Runtime** | Node.js 20+ | Node.js 22+ | Single binary Go | Electron + wolf-server |
| **Server** | Express-like internal | Fastify 5 | Built-in HTTP | wolf-server Go (:4070) |
| **Frontend** | Nenhum (CLI-only) | Next.js 15 (SPA/PWA) | CLI + web launcher básico | Electron + React |
| **Database** | JSON/JSONL files | SQLite (better-sqlite3) + vec | JSON config file | SQLite (wolf.db) |
| **Monorepo** | Sim (packages/) | Sim (packages/) | Não (single binary) | Sim (apps/) |
| **Desktop** | N/A | Electron (opcional, v2) | N/A | Electron (primary) |
| **Mobile** | Nenhum | PWA (Web mobile-first) | Termux no Android | N/A |

---

## 3. Setup & Onboarding

| | **OpenClaw** | **SuperClaw Pure** | **PicoClaw** | **HubAI Nitro** |
|---|---|---|---|---|
| **Install** | `npm i -g openclaw` | `npx superclaw` | Download binary | Install interno PicPay |
| **Time-to-first-message** | 2-3 dias | < 5 min (target) | ~2 min | N/A (pre-configurado) |
| **Setup wizard** | ❌ Editar JSON manual | ✅ Browser wizard (4 telas) | ✅ `picoclaw onboard` (CLI) | ❌ Pré-configurado |
| **Configuração** | `openclaw.json` (complexo) | Browser UI + wizard | `config.json` (simples) | Electron UI |
| **Primeira impressão** | "Intimidador" (Reddit) | "Mágico" (target) | "Impressionante em 2min" | N/A |
| **Zero-config start** | ❌ | ✅ (target) | Quase (precisa API key) | ❌ |
| **Docker** | Não oficial | Sim (v2) | ✅ docker-compose | ❌ |

---

## 4. LLM & Providers

| | **OpenClaw** | **SuperClaw Pure** | **PicoClaw** | **HubAI Nitro** |
|---|---|---|---|---|
| **Providers** | ~15 (Anthropic, OpenAI, Google, Ollama, OpenRouter...) | Universal adapter (OpenAI-compatible + nativos) | model_list (qualquer OpenAI-compatible) | 3 (Anthropic, OpenAI, GitHub Copilot) |
| **Provider padrão** | Anthropic Claude | Setup wizard escolhe | OpenRouter / Zhipu | GitHub Copilot (interno) |
| **Smart routing** | ❌ Manual por sessão | ✅ 3-tier auto (cheap/standard/premium) | ❌ Manual | ❌ |
| **Local LLMs** | ✅ Ollama | ✅ Ollama | ✅ Ollama (via OpenAI-compat) | ❌ |
| **Streaming** | ✅ SSE | ✅ SSE | ✅ SSE | ✅ SSE |
| **Adicionar provider** | Editar JSON | UI + wizard | Adicionar em model_list | Código interno |

---

## 5. Interface (UI/UX)

| | **OpenClaw** | **SuperClaw Pure** | **PicoClaw** | **HubAI Nitro** |
|---|---|---|---|---|
| **Interface primária** | CLI + canais de chat | Web SPA (browser) | CLI | Electron desktop |
| **Dashboard** | ❌ | ✅ (chat + settings + analytics) | ❌ (web launcher mínimo) | ✅ (3-panel layout) |
| **Layout** | N/A | 3-panel (sidebar + chat + right panel) | N/A | 3-panel |
| **Mobile** | Via WhatsApp/Telegram | ✅ PWA mobile-first | ❌ (Termux CLI no Android) | ❌ |
| **Temas** | N/A | Dark/Light/System | N/A | Dark/Light/System |
| **Command palette** | N/A | ✅ ⌘K | N/A | ✅ |
| **Right panel tabs** | N/A | Code, Preview, Browser, Tasks, Automations | N/A | Code, Preview, Browser, Sprint, Flows |
| **Lite/Pro mode** | N/A | ✅ (progressive disclosure) | N/A | ❌ (sempre Pro) |

---

## 6. Agentes & Multi-Agent

| | **OpenClaw** | **SuperClaw Pure** | **PicoClaw** | **HubAI Nitro** |
|---|---|---|---|---|
| **Agents** | 1 principal + configs via IDENTITY.md | CRUD ilimitado via UI | 1 principal | 1 principal |
| **Agent pré-configurado** | Sim (main) | ❌ Nasce virgem | Sim (default agent) | Sim (HubAI agent) |
| **Squads** | ❌ (manual via grupo Discord/TC2) | ✅ Squad CRUD + UI | ❌ | ❌ |
| **@mention routing** | ❌ | ✅ ARCHER v2 | ❌ | ❌ |
| **A2A protocol** | ❌ | ✅ (Fan-out, delegation) | ❌ | ❌ |
| **Agent debate** | ❌ | ✅ (AGECON consensus) | ❌ | ❌ |
| **Sprint workflow** | ❌ | ✅ (NEXUS v3) | ❌ | ❌ |
| **Concurrent execution** | Single-threaded | Worker pool | Subagent spawn (async) | Single-threaded |
| **Multi-gateway** | ❌ | ✅ (BridgePool, SSH tunnels) | ❌ | ❌ |
| **External agent invite** | ❌ | ✅ (pairing + invite URL) | ❌ (ClawdChat.ai) | ❌ |

---

## 7. Memória & Contexto

| | **OpenClaw** | **SuperClaw Pure** | **PicoClaw** | **HubAI Nitro** |
|---|---|---|---|---|
| **Tipo** | Markdown flat files | Typed graph + vector + full-text | Markdown flat (MEMORY.md) | SQLite (flat records) |
| **Persistência** | MEMORY.md no workspace | SQLite transacional | MEMORY.md no workspace | wolf.db |
| **Busca semântica** | ❌ | ✅ (sqlite-vec) | ❌ | ❌ |
| **Busca textual** | ❌ (grep manual) | ✅ (FTS5) | ❌ | ❌ |
| **Tipos de memória** | Livre (markdown) | 6 tipos (Fact, Preference, Decision, Goal, Todo, Event) | Livre (markdown) | Records em SQLite |
| **Memory graph edges** | ❌ | ✅ (RelatedTo, Updates, Contradicts) | ❌ | ❌ |
| **Compaction** | ✅ (mas perde contexto) | ✅ (com typed recall) | ❌ | ❌ |
| **UI para memória** | ❌ | ✅ (browse, search, edit, delete) | ❌ | ❌ |

---

## 8. Tools & Extensibilidade

| | **OpenClaw** | **SuperClaw Pure** | **PicoClaw** | **HubAI Nitro** |
|---|---|---|---|---|
| **Built-in tools** | ~15 (read, write, exec, browser, web_search, web_fetch, image...) | 12+ (rewrite dos wolf tools + novos) | 12 (bash, edit, glob, grep, read, write, webfetch, task, todo, memory, plans, question) | 12 (mesmos do PicoClaw, origin) |
| **MCP client** | ✅ (stdio + HTTP) | ✅ (stdio + HTTP) | ❌ (planejado) | ✅ (stdio + HTTP) |
| **Skills system** | ✅ ClawHub (81 skills) | ✅ Skill store + ClawHub compatible | ✅ Skills dir + persona files | ✅ Skills via workspace |
| **Plugin system** | ❌ | ✅ (custom tool registration API) | ❌ | ✅ (window.wolf sandbox) |
| **Web search** | Brave API | Multi-fallback (Brave → Tavily → DuckDuckGo) | 5 providers com fallback | ❌ (via webfetch tool) |
| **Browser automation** | ✅ (headless via tool) | ✅ (Playwright headless) | ❌ | ❌ |
| **REST API** | ❌ | ✅ (OpenAPI spec) | ❌ | REST (40 endpoints) |
| **Webhooks** | ❌ | ✅ (inbound triggers) | ❌ | ❌ |

---

## 9. Automação & Background

| | **OpenClaw** | **SuperClaw Pure** | **PicoClaw** | **HubAI Nitro** |
|---|---|---|---|---|
| **Cron/Heartbeat** | ✅ HEARTBEAT.md (30min) | ✅ Cron + active hours + circuit breaker | ✅ HEARTBEAT.md (30min) | ✅ Heartbeat |
| **Background jobs** | Session-bound (morre com sessão) | ✅ Persistent job queue (sobrevive restart) | ✅ Subagent spawn (async) | ❌ |
| **Circuit breaker** | ❌ | ✅ (3 failures → auto-disable) | ❌ | ❌ |
| **Active hours** | ❌ | ✅ ("só 9h-18h") | ❌ | ❌ |
| **Approval workflow** | ❌ | ✅ (dangerous actions → pausa → user aprova) | ❌ | ❌ |
| **Notificações push** | Via canais de chat | ✅ Browser push + canais | Via canais de chat | ❌ |

---

## 10. Segurança

| | **OpenClaw** | **SuperClaw Pure** | **PicoClaw** | **HubAI Nitro** |
|---|---|---|---|---|
| **Sandboxing** | Básico (tool-level) | ✅ Workspace sandbox + approval gates | ✅ `restrict_to_workspace` + cmd blocking | Plugin sandbox (window.wolf) |
| **Cmd blocking** | ❌ | ✅ (rm -rf, format, fork bomb) | ✅ (rm -rf, format, dd, fork bomb) | ❌ |
| **API key storage** | JSON plaintext | Encrypted vault (AES-256-GCM) | JSON plaintext | Electron keychain |
| **Audit trail** | ❌ | ✅ (GET /audit) | ❌ | ❌ |
| **Auth** | ❌ (single user assumed) | API key + sessions | ❌ (allowFrom list) | GitHub OAuth (PicPay) |
| **Public sharing** | ❌ | ✅ (shared links, guest chat) | ❌ | ❌ |

---

## 11. Observabilidade

| | **OpenClaw** | **SuperClaw Pure** | **PicoClaw** | **HubAI Nitro** |
|---|---|---|---|---|
| **Usage dashboard** | ❌ | ✅ (token costs, model breakdown) | ❌ | ❌ |
| **Activity heatmap** | ❌ | ✅ | ❌ | ❌ |
| **Agent metrics** | ❌ | ✅ (success rate, response time) | ❌ | ❌ |
| **Cost tracking** | Via session_status (texto) | ✅ Visual (charts) | ❌ | ❌ |
| **Health monitoring** | openclaw status (CLI) | ✅ (gateway health, provider health) | ❌ | ❌ |
| **Export data** | ❌ | ✅ (CSV/JSON) | ❌ | ❌ |

---

## 12. Canais de Comunicação

| | **OpenClaw** | **SuperClaw Pure** | **PicoClaw** | **HubAI Nitro** |
|---|---|---|---|---|
| **Web UI** | ❌ | ✅ (primary) | Launcher básico (:18800) | Electron (primary) |
| **Telegram** | ✅ | ✅ (plugin) | ✅ | ❌ |
| **Discord** | ✅ | ✅ (plugin) | ✅ | ❌ |
| **WhatsApp** | ✅ | ✅ (plugin) | ❌ | ❌ |
| **Slack** | ✅ | ✅ (plugin) | ❌ | ❌ |
| **QQ** | ❌ | ❌ | ✅ | ❌ |
| **DingTalk** | ❌ | ❌ | ✅ | ❌ |
| **LINE** | ❌ | ❌ | ✅ | ❌ |
| **iMessage** | ✅ (BlueBubbles) | ❌ (v2) | ❌ | ❌ |
| **Public chat (link)** | ❌ | ✅ | ❌ | ❌ |
| **Total** | 9 | 6 + web (v1) | 5 + web | 1 (Electron) |

---

## 13. Performance & Recursos

| | **OpenClaw** | **SuperClaw Pure** | **PicoClaw** | **HubAI Nitro** |
|---|---|---|---|---|
| **RAM idle** | >1GB | ~100-200MB | <10MB | ~300-500MB |
| **RAM active** | >1.5GB | ~300-500MB | <20MB | ~500MB-1GB |
| **Startup** | >500s (0.8GHz) | 2-5s | <1s | 5-10s |
| **Binary size** | ~200MB (node_modules) | ~150MB (node_modules) | 14MB (single binary) | ~300MB (Electron) |
| **Min hardware** | Mac/PC ($599+) | Any Node.js ($50+ SBC) | $10 boards! | Mac/PC |
| **Architectures** | x86_64, ARM64 | x86_64, ARM64 | RISC-V, ARM, MIPS, x86 | x86_64, ARM64 |
| **Docker** | Não oficial | ✅ (v2) | ✅ docker-compose | ❌ |

---

## 14. Modelo de Negócio

| | **OpenClaw** | **SuperClaw Pure** | **PicoClaw** | **HubAI Nitro** |
|---|---|---|---|---|
| **Modelo** | Open source (Anthropic backed) | Open source → Freemium | Open source (Sipeed backed) | Interno (PicPay) |
| **Monetização** | Anthropic API usage | Free/Pro/Team ($0/20/50/mo) | Hardware sales (Sipeed boards) | N/A |
| **Target** | Developer individuals | B2C → B2B | IoT / edge developers | PicPay devs |
| **Hosted option** | ❌ | Planejado (v2) | ❌ | N/A |
| **Enterprise** | ❌ | ✅ ($200+/seat/mo) | ❌ | N/A |

---

## 15. Resumo: Onde Cada Um Brilha

| Projeto | Killer Feature | Fraqueza Principal |
|---------|---------------|-------------------|
| **OpenClaw** | Ecossistema gigante (145K⭐, 81 skills, 9 channels) | Setup infernal, sem UI, context amnesia |
| **SuperClaw Pure** | Web-first dashboard + multi-agent + setup wizard | Novo, sem comunidade ainda |
| **PicoClaw** | <10MB RAM, $10 hardware, 1s boot | CLI-only, sem multi-agent, sem dashboard |
| **HubAI Nitro** | 3-panel layout polido, Electron desktop | Proprietário, morto fora do PicPay, single-agent |

---

## 16. O Que SuperClaw Pure Absorve de Cada Um

| Origem | O que absorvemos | Como |
|--------|-----------------|------|
| **OpenClaw** | Ecossistema de skills (ClawHub), HEARTBEAT.md pattern, tool names, channel architecture | Compatibilidade de skills, mesmo formato SKILL.md |
| **PicoClaw** | Onboard wizard, workspace sandboxing, dangerous cmd blocking, model_list config, multi-search fallback, subagent spawn | Implementação própria com melhorias (UI wizard vs CLI) |
| **HubAI Nitro** | 3-panel layout, 12 tool definitions, SSE streaming protocol, SQLite schema base, plugin sandbox concept | Clean-room rewrite (já feito em 57 sprints) |
| **CoWork-OS** | Plugin Store, Digital Twin Personas, Playbook auto-promote, Usage dashboard, Build Mode | Implementação original inspirada no conceito |
| **Spacebot** | Typed memory graph, 4-level model routing, circuit breaker, message coalescing | Adaptação: 6-type graph, 3-tier routing, circuit breaker |
