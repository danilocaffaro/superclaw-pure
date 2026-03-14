# 🧪 QA Consolidado — SuperClaw Pure
**Data:** 2026-03-14
**Fontes:** Alice audit (API+DB), Alice visual (browser), Clark v3 (API+browser), Danilo feedback direto

---

## 🔴 CRITICAL (fix imediato)

| # | Issue | Fonte | Evidência |
|---|-------|-------|-----------|
| C1 | **Auto-scroll to bottom QUEBRADO** — ao abrir DM ou Squad, chat abre no TOPO (mensagens antigas) em vez de scrollar pro fim. Comportamento óbvio que não existe | Danilo + Alice visual | Screenshot: Clark DM abre mostrando task de 22:13 no topo, report recente invisível |
| C2 | **`/api/config/database/export` sem autenticação** — GET baixa o .db inteiro (mensagens, keys, credentials) sem nenhum auth | Clark v3 | `curl http://localhost:4070/api/config/database/export` → download direto |
| C3 | **Stored XSS via agent name** — POST /api/agents aceita `<script>alert(1)</script>` no campo name sem sanitização | Clark v3 + Alice audit | Dado salvo literalmente no DB |
| C4 | **Provider `configured` flag sempre false** — H4 fix mascara key pra `...CYM9`, depois `apiKey.startsWith('...')` retorna true → configured=false. 1 line fix em `providers.ts:116` | Alice audit | Todos 5 providers mostram configured:false na API |

---

## 🟡 MAJOR (backlog prioridade alta)

| # | Issue | Fonte | Evidência |
|---|-------|-------|-----------|
| M1 | **"Loading models..." eterno** — model selector no bottom-left fica "Loading models..." infinitamente. Usuário não consegue trocar modelo | Alice visual | Screenshot: rodapé esquerdo mostra "Loading models..." em toda navegação |
| M2 | **Sem typing indicator** — nenhuma animação de "digitando" quando agente processa resposta. Usuário não sabe se algo está acontecendo | Danilo | Padrão básico de messenger que falta |
| M3 | **Sem unread count badges** — sidebar não mostra número de mensagens não lidas por DM/squad | Danilo | Não tem como saber onde tem atividade nova |
| M4 | **Sem swipe-to-reply / reply threading** — não dá pra responder a uma mensagem específica | Danilo | Padrão WhatsApp/Telegram que falta |
| M5 | **Jornada "Criar Agente" é confusa** — form técnico sem guidance, sem wizard, sem templates sugeridos | Danilo | UX ruim, assusta usuário |
| M6 | **Jornada "Criar Squad / Convidar" é confusa** — flow cru sem step-by-step | Danilo | UX ruim |
| M7 | **Settings > Data & Storage — conteúdo vazio** — tab abre mas corpo em branco. Sem botões de Export/Purge/Info | Alice visual | Screenshot: só título, nenhum conteúdo |
| M8 | **Squad list API retorna 0 agents** — `GET /api/squads` retorna `agents: []`. Endpoint de detalhe retorna correto, mas list não expande JSON de agent_ids | Alice audit | curl confirm |
| M9 | **18 sessões teste/órfãs poluindo sidebar** — 10x "E2E Test" + 3x "Hawk QA Test" + 1x Sprint 73 duplicada + 4x sem título. 33% do total é lixo | Alice audit | DB query confirm |
| M10 | **6 legacy blue bubbles no Dream Team** — mensagens de external agent salvas como `role='user'` (bubble errada). Fix `6e447fe` previne novos, mas não corrigiu dados existentes | Alice audit | DB query confirm |
| M11 | **sw.js NOT stamped** — `curl /sw.js` mostra literal `v__BUILD_TS__`. Service Worker caching completamente quebrado — usuários recebem conteúdo stale | Alice audit | curl confirm |
| M12 | **Tokens sempre 0 com github-copilot** — `stream_options: { include_usage: true }` é enviado mas Copilot não retorna `data.usage` → analytics/custos não funcionam pra esse provider | Clark v3 | `message.finish` sempre `tokens_in:0, tokens_out:0, cost:0` |
| M13 | **Squad mostra "🤖 Assistant" genérico** — primeiro step do Dream Team mostra tag "Assistant" em vez de Clark 🐙. Usuário não sabe quem respondeu | Alice visual | Screenshot confirm |
| M14 | **External agent Alice não aparece na sidebar** — `0de33824` existe em `external_agents` mas não em `agents`. UI mostra 2 agentes quando squad tem 3 | Alice audit | DB + API confirm |
| M15 | **DB purge stubado** — `POST /config/database/purge` retorna sucesso mas não faz nada | Clark v3 | curl confirm |
| M16 | **Provider aceita API key falsa sem validar** — `PUT /config/providers/:id` retorna `connected` com key fake. Validação só no `test` endpoint | Clark v3 | curl confirm |
| M17 | **13 sessions ghost sem agent_id** — sessões no DB sem referência a agente ou squad | Clark v3 | DB query confirm |
| M18 | **Session aceita agentId inválido** — POST /api/sessions com `agentId: "test-123"` cria sessão sem FK validation | Alice audit + Clark v3 | DB confirm |

---

## 🟢 MINOR / NICE-TO-HAVE

| # | Issue | Fonte |
|---|-------|-------|
| N1 | **Language default = English** — deveria detectar idioma do browser ou default PT-BR pra install BR | Alice visual |
| N2 | **Dark theme como default** — B2C deveria default Light | Danilo + Alice |
| N3 | **Paleta de cores genérica** — funcional mas sem personalidade. Precisa Radix Colors ou similar | Danilo |
| N4 | **POST /sessions/:id/messages (plural) → 404** — só `/message` funciona, pode confundir dev | Clark v3 |
| N5 | **`/api/analytics` não existe** — retorna 404 | Clark v3 |
| N6 | **Agent model/provider como N/A no list** — UI não sabe qual modelo cada agente usa | Alice audit |
| N7 | **Falta scroll-to-bottom FAB** — botão flutuante quando user scrollou pra cima, com badge "N novas" | Danilo |
| N8 | **Falta read receipts** — ✓ enviado, ✓✓ entregue/lido | Danilo |
| N9 | **Falta timestamps visíveis** — agrupamento por data ("Today", "Yesterday"), hover mostra hora exata | Danilo |

---

## ✅ PASS (funcionando bem)

| # | Item |
|---|------|
| P1 | Health endpoint: 200 OK, versão/uptime corretos |
| P2 | Security headers: CSP, X-Frame-Options DENY, sem fingerprint |
| P3 | Rate limiting: funcionando (200 limit, localhost exempt) |
| P4 | Self-watchdog: healthy, 0 consecutive failures |
| P5 | Markdown rendering: tabelas, código, headings, emojis — tudo correto |
| P6 | Agents CRUD: criar/listar/editar agente funciona |
| P7 | Chat SSE streaming: mensagem enviada → resposta recebida via stream |
| P8 | Squads: criar squad, ver histórico, agents no detalhe |
| P9 | Appearance settings: Dark/Light/System, Lite/Pro mode |
| P10 | 456 tests passing, 0 TS errors |
| P11 | launchd auto-restart: kill -9 → recovery em ~5s |
| P12 | Providers tab: carrega, mostra providers (apesar de flag `configured` errado) |

---

## 📊 Resumo

| Severidade | Count |
|-----------|-------|
| 🔴 Critical | 4 |
| 🟡 Major | 18 |
| 🟢 Minor | 9 |
| ✅ Pass | 12 |

**Score: 6.5/10** — Core funciona, mas UX messenger-grade está longe. Falta o básico que qualquer humano espera (auto-scroll, typing, unread badges).

---

## 🎯 Sprint Plan (prioridade)

### Sprint 75 — Criticals (estimativa ~4h)
- C1: Auto-scroll to bottom
- C2: Auth no DB export
- C3: Input sanitization (XSS)
- C4: Provider configured flag fix

### Sprint 76 — Major UX (estimativa ~8h)
- M1: Loading models fix
- M7: Data & Storage tab
- M8: Squad list expand agents
- M9: Session cleanup (delete lixo)
- M10: Blue bubbles data migration
- M11: sw.js stamp fix
- M13: Squad agent identity

### Sprint 77 — Messenger-Grade UX (estimativa ~14h)
- M2: Typing indicator
- M3: Unread count badges
- M4: Swipe-to-reply + threading
- M5+M6: Wizard journeys
- N7: Scroll-to-bottom FAB

### Backlog (Tier 3)
- N1-N9: Appearance, language, analytics, etc.
