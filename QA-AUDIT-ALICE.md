# 🐕 Alice QA Audit — SuperClaw Pure Full Product Scan
**Date:** 2026-03-13 ~20:45 BRT
**Method:** API calls + DB queries + frontend asset checks
**Score: 7/10**

---

## 🔴 FAIL (Critical)

| # | Issue | Evidence |
|---|-------|----------|
| F1 | **Provider `configured` flag always false** | All 5 providers show `configured: false` in API despite GitHub Copilot having a valid API key. **Root cause:** H4 fix masks key to `...CYM9`, then `apiKey.startsWith('...')` returns true → `configured = false`. Logic error in `apps/server/src/api/providers.ts:116` |
| F2 | **sw.js NOT stamped — stale cache** | `curl http://localhost:4070/sw.js` shows literal `v__BUILD_TS__` placeholder. Service Worker caching is **completely broken** — users will get stale content forever. Build command ran but `out/sw.js` has the placeholder, not the timestamp |
| F3 | **6 legacy blue bubbles in Dream Team squad** | `messages` table has 6 rows with `role='user'` containing `"Previous agent's analysis:"` — these are external agent responses rendered on the wrong side. Backend fix (commit `6e447fe`) prevents NEW ones but didn't repair existing data |
| F4 | **18 test/orphan sessions polluting sidebar** | 10× "E2E Test" + 3× "Hawk QA Test" + 1× duplicate Sprint 73 + 4× untitled sessions. 33% of all sessions are garbage. No cleanup mechanism |
| F5 | **Squad list API returns 0 agents** | `GET /api/squads` returns `agents: []` for Dream Team. The detail endpoint returns correct `agentIds`. List endpoint doesn't expand `agent_ids` JSON |

---

## ⚠️ WARNING

| # | Issue | Evidence |
|---|-------|----------|
| W1 | **External agent Alice not in agents table** | `0de33824` exists only in `external_agents`, not `agents`. Squad has 3 agent IDs but `GET /api/agents` shows only 2 (Clark + Hawk). UI may not render Alice in squad view |
| W2 | **Session references fake agent** | Session `68c01919` has `agent_id="test-123"` — no FK validation |
| W3 | **7 empty sessions (0 messages)** | DB bloat, visual noise in sidebar |
| W4 | **Agent model/provider show as N/A in list** | `GET /api/agents` strips model info — UI can't show which model each agent uses |

---

## ✅ PASS

| # | Item |
|---|------|
| P1 | Health endpoint: 200 OK, correct version/uptime |
| P2 | Security headers: full CSP, X-Frame-Options DENY, no server fingerprint |
| P3 | Rate limiting: working (200 limit, decrementing correctly) |
| P4 | Manifest.json: present, correct name/theme/icons count |
| P5 | Favicon: 200 OK |
| P6 | Zero empty/null message content in DB |
| P7 | Zero timestamp violations |
| P8 | Agent names unique, colors unique |
| P9 | Squad agent IDs all resolve (2 local + 1 external) |
| P10 | 444 tests passing, 0 TS errors |

---

## 📊 Priority Fixes

1. **F1** Provider configured flag — 1 line fix in providers.ts (check raw key, not masked)
2. **F2** SW stamp — fix build pipeline (public/sw.js → out/sw.js)
3. **F3** Blue bubbles — data migration to fix existing 6 rows
4. **F4** Session cleanup — delete test/orphan sessions
5. **F5** Squad list expand — include agent objects in list endpoint
