# 🦅 Hawk QA Audit — SuperClaw Pure Full Product Scan
**Date:** 2026-03-13 ~20:49 BRT
**Method:** API testing, DB queries, frontend assets, security vectors
**Score: 7.5/10 — CONDITIONAL PASS**

---

## 🔴 FAIL (Critical)

| # | Severity | Issue | Detail |
|---|----------|-------|--------|
| 1 | 🔴 Critical | **Stored XSS via agent name** | `POST /api/agents` with `name: "<script>alert(1)</script>"` → stored in DB, returned unsanitized via `GET /api/agents`. If frontend renders without escaping → full XSS |
| 2 | 🔴 Critical | **PWA manifest icons 404** | `manifest.json` references icon paths that return 404. Chrome/Safari won't offer "Add to Home Screen". PWA install completely broken |
| 3 | 🟡 Major | **No real favicon.ico** | `/favicon.ico` returns SPA index.html (7742 bytes text/html). Browser shows blank icon |
| 4 | 🟡 Major | **Service Worker build version not injected** | `sw.js` has literal `v__BUILD_TS__` placeholder. Cache busting broken |
| 5 | 🟡 Major | **Path traversal returns 200** | `GET /api/../../../etc/passwd` → 200 (SPA). No leak but bad signal for scanners |

---

## ⚠️ WARNING

| # | Severity | Issue | Detail |
|---|----------|-------|--------|
| 6 | 🟡 Major | **7 empty/orphan sessions** (33% of total) | Test artifacts not cleaned up |
| 7 | 🟡 Major | **10 duplicate "E2E Test" sessions** | Test runner creating without cleanup |
| 8 | 🟡 Major | **Session references non-existent agent** | `agent_id="test-123"` — no FK validation |
| 9 | 🟢 Minor | **4 untitled sessions** | Empty titles |
| 10 | 🟢 Minor | **4 DB files scattered** | Real DB + ghost copies in other dirs |
| 11 | 🟢 Minor | **11 console.* calls in server** | Should use structured Pino logger |
| 12 | 🟢 Minor | **5 `: any` type usages** | Minor type safety gap |

---

## 📊 Metrics

| Metric | Value |
|--------|-------|
| TTFB avg | **0.5ms** ⚡ |
| Sessions analyzed | 21/21 (100%) |
| Messages analyzed | 153/153 (100%) |
| Empty content | 0 |
| Timestamp violations | 0 |
| Orphan sessions | 7 (33%) |
| Security vectors tested | 5 |

---

## 🏆 Top 5 Priority Fixes

1. 🔴 Stored XSS — sanitize agent name on input
2. 🔴 PWA manifest icons — fix paths
3. 🟡 No favicon.ico — add real favicon
4. 🟡 SW build version — inject timestamp in build
5. 🟡 Session cleanup — auto-delete empty sessions > 1h
