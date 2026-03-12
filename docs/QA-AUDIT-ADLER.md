# QA Audit — SuperClaw Pure

| Field      | Value                                      |
|------------|--------------------------------------------|
| Date       | 2026-03-12                                 |
| Repo       | danilocaffaro/superclaw-pure               |
| Branch     | main (246cb22)                             |
| Auditor    | Adler 🦊 (Tech Lead) — manual deep read    |
| Stack      | Fastify v5 · better-sqlite3 · TypeScript ESM · Next.js 15 static export |
| Coverage   | ~20,600 LOC server-side, 97 source files   |

---

## Score: 6.5 / 10

Arquitetura limpa, TypeScript strict sem erros, SQL 100% parametrizado. Pontos fracos: 3 issues críticos de segurança que permitem LFI/RCE, acesso não-autenticado a audit log e API keys, e passphrase hardcoded no vault de credenciais.

---

## Top 5 Critical Findings

| # | Severity | Issue | File |
|---|----------|-------|------|
| 1 | Critical | Path traversal irrestrito — GET /files/read?path=/etc/passwd funciona | api/files.ts:127 |
| 2 | Critical | /audit endpoint sem autenticação — audit log público | api/auth.ts:213 |
| 3 | Critical | TOCTOU em one-time credentials — double-retrieval possível | db/credentials.ts:126 |
| 4 | High | Hardcoded passphrase 'default-superclaw-key' para criptografia de credenciais | api/credentials.ts:75,196 |
| 5 | High | Dev auth bypass — owner automático se NODE_ENV != production | api/auth.ts:13 |

---

## Full Findings

### SECURITY — Critical

#### [SEC-01] Path Traversal via Absolute Paths

**File:** `apps/server/src/api/files.ts:127-134`

`guardPath()` permite paths absolutos sem verificar containment no workspace:

```ts
const resolved = requestedPath.startsWith('/')
  ? resolve(requestedPath)          // sem contenção — LFI direto!
  : resolve(join(workspacePath, requestedPath));
if (requestedPath.includes('..')) return null;  // só bloqueia ".." — inútil contra paths absolutos
return resolved;
```

Impacto: qualquer usuário autenticado (ou anônimo em dev) pode:
- `GET /files/read?path=/etc/passwd` — leitura irrestrita de filesystem
- `GET /files/read?path=/root/.ssh/id_rsa` — chave privada SSH
- `PUT /files/write` com `{"path": "/etc/cron.d/backdoor"}` — RCE

**Fix:**
```ts
function guardPath(requestedPath: string, workspacePath: string): string | null {
  if (requestedPath.includes('..')) return null;
  const resolved = requestedPath.startsWith('/')
    ? resolve(requestedPath)
    : resolve(join(workspacePath, requestedPath));
  // Verificar containment PARA TODOS os paths, inclusive absolutos
  const safeRoot = workspacePath.endsWith(path.sep) ? workspacePath : workspacePath + path.sep;
  if (!resolved.startsWith(safeRoot) && resolved !== workspacePath) return null;
  return resolved;
}
```

---

#### [SEC-02] /audit Endpoint Sem Autenticação

**File:** `apps/server/src/api/auth.ts:213-228`

Existe `/auth/audit` (com `requireRole('admin')`) **e** um alias `/audit` criado para compatibilidade com SecurityTab. O alias não tem nenhum check:

```ts
// GET /audit — alias for SecurityTab
app.get('/audit', async (req, reply) => {
  const { userId, action, limit } = req.query;
  const entries = audit.list({ userId, action, limit: ... });
  return { data: entries };  // sem caller check, sem requireRole()
```

O audit log expõe IPs, ações de usuários, timestamps de operações sensíveis.

**Fix:** Adicionar antes do `audit.list()`:
```ts
const caller = getAuthUser(req, users);
if (!requireRole(caller, 'admin')) {
  return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Requires admin role' } });
}
```

---

#### [SEC-03] Race Condition (TOCTOU) em Credentials One-Time

**File:** `apps/server/src/db/credentials.ts:126-152`

`retrieveCredential()` faz check-then-act sem transação:

```
1. SELECT row — verifica one_time/used
2. decrypt()
3. UPDATE used = 1   ← entre o SELECT e o UPDATE, dois requests paralelos passam no check
```

**Fix — transação atômica:**
```ts
const tx = this.db.transaction((id: string, passphrase: string) => {
  const row = this.db.prepare(
    `SELECT * FROM credential_vault WHERE id = ? AND (one_time = 0 OR used = 0)`
  ).get(id) as VaultRow | undefined;
  if (!row) return null;
  const plaintext = decrypt(row.encrypted_value, row.iv, row.salt, passphrase);
  if (row.one_time === 1) {
    this.db.prepare(`UPDATE credential_vault SET used = 1, updated_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), id);
  }
  return plaintext;
});
return tx(id, passphrase);
```

---

### SECURITY — High

#### [SEC-04] Hardcoded Passphrase 'default-superclaw-key'

**File:** `apps/server/src/api/credentials.ts:75` e `:196`

```ts
passphrase: passphrase || 'default-superclaw-key',          // linha 75
const passphrase = req.body?.passphrase || 'default-superclaw-key';  // linha 196
```

Com o repo público, qualquer atacante pode chamar `POST /credentials/vault/:id/retrieve` com body vazio e decriptar **qualquer credencial** armazenada sem passphrase explícita.

**Fix:** Remover o fallback. Exigir passphrase ou derivar de env var:
```ts
const passphrase = req.body?.passphrase;
if (!passphrase) {
  return reply.status(400).send({ error: { code: 'VALIDATION', message: 'passphrase required' } });
}
```

---

#### [SEC-05] Dev Auth Bypass — Owner Automático

**File:** `apps/server/src/api/auth.ts:13-19`

```ts
if (process.env.NODE_ENV === 'production') return null;
const allUsers = users.list();
return allUsers[0] ?? null;  // owner automático
```

Se um deploy esquece de definir `NODE_ENV=production`, toda a API fica publicamente acessível como owner. Padrão opt-out é perigoso.

**Fix — opt-in explícito:**
```ts
const isDev = process.env.NODE_ENV === 'development' || process.env.SUPERCLAW_DEV_AUTH === 'true';
if (!isDev) return null;
// warn in logs if SUPERCLAW_DEV_AUTH is set
```

---

#### [SEC-06] /api/auth/api-keys e Sessions Sem Auth Check

**File:** `apps/server/src/api/auth.ts:230-295`

Endpoints de compatibilidade SecurityTab (`GET /api/auth/api-keys`, `POST /api/auth/api-keys`, `POST .../rotate`, `DELETE .../id`, `GET /api/auth/sessions`, `DELETE .../id`) sem nenhum check de autenticação ou role. Qualquer um pode listar, criar e rotacionar API keys.

**Fix:** `requireRole(caller, 'admin')` em todos os handlers.

---

### BUGS — Medium

#### [BUG-01] idx_tasks_session Index Criado Antes da Tabela

**File:** `apps/server/src/db/schema.ts:83 vs :230`

Tabela `tasks` está comentada no bloco principal (linha 83) mas `CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_id)` está ativo na linha 230. Em fresh installs, o index é criado com `try/catch` silencioso antes da tabela existir (migração B056). Resultado: index nunca criado, queries em tasks por session_id fazem full table scan.

**Fix:** Mover `CREATE INDEX` para dentro da migração B056.

---

#### [BUG-02] Non-Null Assertion Não Segura Após UPDATE/INSERT

**File:** `apps/server/src/db/users.ts:63,80-96`

`update()` e `create()` usam `getById(id)!`. Se a row for deletada concorrentemente entre a escrita e a leitura, lança `TypeError` não tratado.

**Fix:**
```ts
const result = this.getById(id);
if (!result) throw new Error(`User '${id}' not found after write`);
return result;
```

---

### TYPE SAFETY — Medium

#### [TYPE-01] body: any em Webhook Parsers

**File:** `apps/server/src/api/channels.ts:240,250,261,270`

`parseTelegramUpdate`, `parseDiscordInteraction`, `parseSlackEvent`, `parseInbound` recebem `body: any`. Acesso não-seguro a propriedades aninhadas pode causar runtime errors com payloads malformados.

**Fix:** `body: unknown` + type guards:
```ts
function parseTelegramUpdate(body: unknown): { fromId: string; text: string } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (!b.message || typeof b.message !== 'object') return null;
  // ...
}
```

---

#### [TYPE-02] rowToConfig Recebe any

**File:** `apps/server/src/api/channels.ts:143`

`rowToConfig(row: any)` — sem tipagem explícita da row SQLite. Mudanças de schema são invisíveis em compile time.

**Fix:** Definir interface `ChannelRow` com todos os campos mapeados.

---

### ERROR HANDLING — Low

#### [ERR-01] catch Vazio em workflow-repository.ts

**File:** `apps/server/src/db/workflow-repository.ts:100,135`

JSON parse de `steps` e `params` falha silenciosamente. Dados corrompidos passam despercebidos.

**Fix:** `catch (e) { logger.warn('Failed to parse workflow data', e); }`

---

#### [ERR-02] 17+ catch Non-Fatal Silenciosos em agent-memory.ts

**File:** `apps/server/src/db/agent-memory.ts` (linhas 56, 344, 392, 440, 475, 515, 565, 577, 593, 604, 614, 668, 694, 740, 764, 830)

Muitas operações de memória falham silenciosamente. Dificulta debugging em produção.

**Fix:** Helper `swallow(label: string, fn: () => void)` que loga antes de engolir.

---

#### [ERR-03] retrieveCredential: Passphrase Errada vs Corrompido Indistinguível

**File:** `apps/server/src/db/credentials.ts:150`

Ambos retornam `null`. Tentativas com passphrase errada deveriam gerar evento de auditoria para detectar força bruta.

---

### HARDCODING — Low

| ID | File | Issue | Fix |
|----|------|-------|-----|
| HC-01 | defaults.ts:11 | DEFAULT_HOST = '0.0.0.0' — sem warning | Log warning se sem HTTPS/proxy |
| HC-02 | files.ts:248 | UPLOAD_DIR = '/tmp/superclaw-uploads' — não persiste em containers | `process.env.SUPERCLAW_UPLOAD_DIR ?? '/tmp/...'` |
| HC-03 | defaults.ts:80 | DEFAULT_SYSTEM_PROMPT hardcoded | Configurável por env var |

---

### PERFORMANCE — Low

| ID | File | Issue | Fix |
|----|------|-------|-----|
| PERF-01 | auth.ts:18 | `users.list()` full scan em cada request dev auth | `SELECT ... LIMIT 1` |
| PERF-02 | files.ts:89 | `statSync()` síncrono em tree builder — bloqueia event loop em repos grandes | `readdirSync` com `withFileTypes: true` |

---

### API INCONSISTENCIES — Low

#### [API-01] sendMessage chama /sessions/:id/message (singular)

**File:** `apps/web/src/lib/api.ts:55`

Frontend chama `/sessions/${id}/message`. Verificar se servidor registra `/message` ou `/messages`. Se for plural, 404 silencioso em produção.

---

### TEST COVERAGE GAPS — Low

| ID | Issue | Fix |
|----|-------|-----|
| TEST-01 | `guardPath` sem test para absolute path bypass | `expect(guardPath('/etc/passwd', '/workspace')).toBeNull()` |
| TEST-02 | Sem concurrency test para one-time credentials | Simular 2 requests paralelos, verificar que apenas 1 retorna valor |

---

## Summary Table

| ID | Severity | Category | File:Line | Issue |
|----|----------|----------|-----------|-------|
| SEC-01 | **Critical** | Security | files.ts:127 | Path traversal via absolute paths (LFI/RCE) |
| SEC-02 | **Critical** | Security | auth.ts:213 | /audit alias sem autenticação |
| SEC-03 | **Critical** | Security | credentials.ts:126 | TOCTOU em one-time credentials |
| SEC-04 | **High** | Hardcoding | credentials.ts:75,196 | Passphrase hardcoded 'default-superclaw-key' |
| SEC-05 | **High** | Security | auth.ts:13 | Dev auth bypass por default |
| SEC-06 | **High** | Security | auth.ts:230 | API keys/sessions endpoints sem auth |
| BUG-01 | **Medium** | Bug | schema.ts:230 | Index antes da tabela — fresh install quebrado |
| BUG-02 | **Medium** | Bug | users.ts:63,80 | Non-null assertion pós-write não segura |
| TYPE-01 | **Medium** | Type Safety | channels.ts:240 | body: any em webhook parsers |
| TYPE-02 | **Medium** | Type Safety | channels.ts:143 | rowToConfig(row: any) |
| ERR-01 | **Low** | Error Handling | workflow-repository.ts:100 | catch vazio em JSON parse |
| ERR-02 | **Low** | Error Handling | agent-memory.ts (16x) | catch silenciosos massivos |
| ERR-03 | **Low** | Error Handling | credentials.ts:150 | Passphrase errada sem auditoria |
| HC-01 | **Low** | Hardcoding | defaults.ts:11 | 0.0.0.0 bind sem warning |
| HC-02 | **Low** | Hardcoding | files.ts:248 | /tmp upload dir hardcoded |
| HC-03 | **Low** | Hardcoding | defaults.ts:80 | System prompt hardcoded |
| PERF-01 | **Low** | Performance | auth.ts:18 | users.list() full scan em dev |
| PERF-02 | **Low** | Performance | files.ts:89 | statSync síncrono em tree builder |
| API-01 | **Low** | API | api.ts:55 | message vs messages endpoint |
| TEST-01 | **Low** | Tests | files.test.ts | Sem test absolute path bypass |
| TEST-02 | **Low** | Tests | credentials.test.ts | Sem concurrency test one-time |

---

## Conclusões

### Ação imediata (antes de qualquer deploy público):

1. **SEC-01** — Uma linha: verificar `resolved.startsWith(workspacePath)` APÓS o resolve.
2. **SEC-02** — Copiar o `requireRole(admin)` do `/auth/audit` para o alias `/audit`.
3. **SEC-03** — Envolver `retrieveCredential()` em `this.db.transaction()`.
4. **SEC-04** — Remover `|| 'default-superclaw-key'` dos dois locais.

### Sprint seguinte:

5. **SEC-05** — Inverter lógica dev auth para opt-in (`SUPERCLAW_DEV_AUTH=true`).
6. **SEC-06** — `requireRole(admin)` nos endpoints de API keys e sessions.

### Pontos positivos:

- **SQL injection: zero** — 100% parametrizado em todos os 97 arquivos
- **TypeScript strict** ativo, 0 erros de compilação
- **ROLE_HIERARCHY** bem modelado, `requireRole()` consistente nos endpoints principais
- **Schema migrations** explícitas por coluna — robusto para upgrades sem downtime
- **140 testes passando** — boa base de confiança para refatorações

---

*Audit manual por Adler 🦊 — 2026-03-12 — leitura direta de apps/server/src/ (Codex/Claude indisponíveis neste ambiente)*
