# 🐕 Alice — QA Visual Completo (Browser Navigation)
**Date:** 2026-03-13 20:55 BRT
**Method:** Browser real — navegação completa por todas as telas
**Score: 6.5/10**

---

## 🔴 CRITICAL FINDINGS (Release Blockers)

### F1 — Alice aparece como 🤖 genérico no squad
- **Onde:** Sidebar (Dream Team squad badge) + squad header
- **O que:** Alice (external agent 0de33824) renderiza como "🤖" robô genérico ao invés de "🐕"
- **Causa:** External agents não têm emoji no squad agent list. O frontend faz fallback pra 🤖
- **Impacto:** Experiência confusa — "quem é esse robô no meio do time?"

### F2 — Blue bubbles AINDA EXISTEM no Dream Team chat
- **Onde:** Squad chat, mensagens da Alice
- **O que:** "Previous agent's analysis:" aparece como mensagem do USUÁRIO (blue, right-aligned)
- **Causa:** 6 mensagens legacy com `role='user'` no DB. Backend fix previne novos, mas legados permanecem
- **Impacto:** Confusão visual — parece que o usuário escreveu a análise da Alice

### F3 — Squad chat tem mensagem duplicada
- **Onde:** Primeira interação do Dream Team
- **O que:** "Hello team! What can each of you do?" aparece DUAS VEZES (15:10 e 15:13)
- **Causa:** Provavelmente double-submit ou retry. E Clark respondeu duas vezes (duas respostas diferentes)

### F4 — "[Max tool iterations reached. Stopping.]" aparece 4x no chat
- **Onde:** Dream Team squad chat
- **O que:** Mensagens de Clark terminam abruptamente com essa mensagem técnica
- **Impacto:** Usuário final vê mensagem de debug/sistema. Péssimo UX

### F5 — "Loading..." infinito em 4 Settings tabs
- **Onde:** MCP Servers, Vault (parcial), Deploys/Analytics Overview
- **O que:** Spinner eterno, conteúdo nunca carrega
- **Causa:** Endpoints não existem ou retornam dados que o frontend não consegue renderizar

### F6 — Agents tab mostra "0 Total, 0 Active, 0 Offline"
- **Onde:** Settings → Agents
- **O que:** Contadores zerados apesar de 2 agents reais (Clark + Hawk) no DB
- **Causa:** Contagem pode depender de campo `status` que não existe, ou query errada

### F7 — Data & Storage completamente vazio
- **Onde:** Settings → Data & Storage
- **O que:** Tab existe no menu mas zero conteúdo na área principal
- **Causa:** Componente não implementado

### F8 — Impersonation no squad (mensagens falsas de "Clark")
- **Onde:** Dream Team chat — mensagens com "🐙 Clark aqui!" que NÃO são do Clark
- **O que:** Alice (via External Agent Protocol) postou como se fosse Clark. Clark detectou e alertou TRÊS VEZES
- **Causa:** External agents postam com role='user' e texto livre. Sem message signing
- **Impacto:** Gap de segurança do protocolo. Clark citou Safety Law #5 corretamente

---

## ⚠️ WARNING

### W1 — "Loading models..." permanente no model selector
- **Onde:** Bottom left da sidebar, model dropdown
- **O que:** Mostra "Loading models..." mas nunca resolve

### W2 — Version inconsistency
- **Onde:** Settings → Advanced
- **O que:** Shows "0.2.0" mas git tags são v1.0.0 e v1.0.1

### W3 — Right sidebar (Code/Preview/Browser/Tasks/Automations) — todo vazio
- **Onde:** Panel direito
- **O que:** 5 tabs mas nenhuma funciona. "No file selected", "No project directory"
- **Causa:** Dev-centric features sem implementação real

### W4 — Webhook URL hardcoded em Integrations
- **Onde:** Settings → Integrations → Webhooks
- **O que:** `https://your-app.com/webhooks/superclaw` — deveria ser editável

### W5 — Squad agentIds não expandidos no list endpoint
- **Onde:** GET /api/squads retorna `agent_ids` como JSON string, não expande pra objetos

### W6 — "Build on this analysis. Provide the final synthesized answer."
- **Onde:** Aparece no final de TODAS as respostas da Alice no squad chat
- **O que:** É o prompt de context injection do External Agent Protocol vazando pro chat visível
- **Impacto:** Expõe internals do sistema pro usuário

### W7 — Pro/Lite toggle sem explicação
- **Onde:** Sidebar bottom — "⚡ Pro" button e "Go Lite"
- **O que:** Não fica claro o que muda entre Pro e Lite

---

## ✅ WORKING WELL

| # | Item |
|---|------|
| P1 | Chat rendering — markdown, tables, code blocks, headings renderizam bem |
| P2 | Clark responses são detalhadas e úteis |
| P3 | Hawk QA report renderiza perfeitamente no chat |
| P4 | Sidebar ordering — sessions mais recentes no topo |
| P5 | Squad header mostra "sequential" strategy + agent count |
| P6 | Settings modal — navegação entre tabs funciona |
| P7 | Security tab tem toggles funcionais |
| P8 | Advanced tab tem Experimental Features com toggles |
| P9 | Keyboard shortcuts funcionam (⌘K, Escape) |
| P10 | General/Appearance tabs funcionam |

---

## 📊 Summary

| Category | Count |
|----------|-------|
| 🔴 Critical | 8 |
| ⚠️ Warning | 7 |
| ✅ Pass | 10 |
| **Score** | **6.5/10** |

## 🎯 Top 5 Priority Fixes

1. **F4+W6** — Esconder "[Max tool iterations reached]" e "Build on this analysis" do chat visível — são internals do sistema
2. **F5+F6+F7** — Settings tabs "Loading..." — ou implementar ou remover tabs fantasma
3. **F1** — External agent emoji no squad — usar emoji da config, não fallback 🤖
4. **F8+W6** — Context injection leaking + impersonation gap — message signing no External Agent Protocol
5. **F2+F3** — Data cleanup — fix blue bubbles legacy + remove duplicate messages
