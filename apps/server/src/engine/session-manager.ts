// ============================================================
// Session Manager — SQLite-backed conversation persistence
// ============================================================

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';

const SUPERCLAW_DIR = join(homedir(), '.superclaw');
const DB_PATH = join(SUPERCLAW_DIR, 'superclaw.db');

// ─── Public Interfaces ────────────────────────────────────────────────────────

export interface SessionInfo {
  id: string;
  title: string;
  provider_id: string;
  model_id: string;
  agent_id: string;
  mode: string; // 'dm' | 'squad'
  squad_id: string;
  created_at: string;
  updated_at: string;
}

export interface MessageInfo {
  id: string;
  session_id: string;
  role: string; // 'user' | 'assistant' | 'system' | 'tool'
  content: string;
  agent_id: string;
  tool_name: string;
  tool_input: string;
  tool_result: string;
  tokens_in: number;
  tokens_out: number;
  cost: number;
  created_at: string;
}

export type CreateSessionOpts = {
  title?: string;
  provider_id?: string;
  model_id?: string;
  agent_id?: string;
  mode?: string;
  squad_id?: string;
};

export type AddMessageOpts = {
  role: string;
  content: string;
  agent_id?: string;
  tool_name?: string;
  tool_input?: string;
  tool_result?: string;
  tokens_in?: number;
  tokens_out?: number;
  cost?: number;
};

// ─── Row types (raw SQLite) ───────────────────────────────────────────────────

interface SessionRow {
  id: string;
  title: string;
  provider_id: string;
  model_id: string;
  agent_id: string;
  mode: string;
  squad_id: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;            // stored as JSON array string in schema, but we flatten to string here
  agent_id: string;
  tool_name: string | null;
  tool_input: string | null;
  tool_result: string | null;
  tokens_input: number;       // schema column name
  tokens_output: number;      // schema column name
  cost: number;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise the `content` column.
 *
 * The schema stores `content TEXT NOT NULL DEFAULT '[]'` — the Anthropic provider
 * saves it as a JSON array of content blocks.  For external consumers we expose
 * a plain string.  When we write we always store a JSON string so the column
 * stays consistent with what the LLM providers produce.
 */
function contentToString(raw: string): string {
  if (!raw || raw === '[]') return '';
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'string') return parsed;
    if (Array.isArray(parsed)) {
      // Extract text from blocks like [{type:'text', text:'...'}]
      return parsed
        .map((b: unknown) => {
          if (typeof b === 'string') return b;
          if (b && typeof b === 'object' && 'text' in b) return (b as { text: string }).text;
          return '';
        })
        .join('');
    }
  } catch {
    // not JSON — return as-is
  }
  return raw;
}

function stringToContentJson(content: string): string {
  // If it already looks like a JSON array, leave it alone
  const trimmed = content.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      /* fall through */
    }
  }
  return JSON.stringify([{ type: 'text', text: content }]);
}

function rowToSessionInfo(row: SessionRow): SessionInfo {
  return {
    id: row.id,
    title: row.title ?? '',
    provider_id: row.provider_id ?? '',
    model_id: row.model_id ?? '',
    agent_id: row.agent_id ?? '',
    mode: row.mode ?? 'dm',
    squad_id: row.squad_id ?? '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToMessageInfo(row: MessageRow): MessageInfo {
  return {
    id: row.id,
    session_id: row.session_id,
    role: row.role,
    content: contentToString(row.content),
    agent_id: row.agent_id ?? '',
    tool_name: row.tool_name ?? '',
    tool_input: row.tool_input ?? '',
    tool_result: row.tool_result ?? '',
    tokens_in: row.tokens_input ?? 0,
    tokens_out: row.tokens_output ?? 0,
    cost: row.cost ?? 0,
    created_at: row.created_at,
  };
}

// ─── Compact threshold ────────────────────────────────────────────────────────

const COMPACT_KEEP_LAST = 20;   // keep the N most-recent messages after compaction
const COMPACT_MIN_TOTAL = 40;   // only compact when there are at least this many messages

// ─── SessionManager ───────────────────────────────────────────────────────────

export class SessionManager {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? DB_PATH;
    // Ensure directory exists
    mkdirSync(join(resolvedPath, '..'), { recursive: true });
    this.db = new Database(resolvedPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  // ── Session CRUD ────────────────────────────────────────────────────────────

  createSession(opts: CreateSessionOpts = {}): SessionInfo {
    const id = randomUUID();
    const now = new Date().toISOString();
    const title = opts.title ?? '';
    const provider_id = opts.provider_id ?? '';
    const model_id = opts.model_id ?? '';
    const agent_id = opts.agent_id ?? '';
    const mode = opts.mode ?? 'dm';
    const squad_id = opts.squad_id ?? '';

    this.db.prepare(`
      INSERT INTO sessions (id, title, agent_id, squad_id, mode, provider_id, model_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, agent_id, squad_id, mode, provider_id, model_id, now, now);

    return {
      id,
      title,
      provider_id,
      model_id,
      agent_id,
      mode,
      squad_id,
      created_at: now,
      updated_at: now,
    };
  }

  getSession(id: string): SessionInfo | null {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | undefined;
    if (!row) return null;
    return rowToSessionInfo(row);
  }

  listSessions(): SessionInfo[] {
    const rows = this.db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all() as SessionRow[];
    return rows.map(rowToSessionInfo);
  }

  updateSession(id: string, patch: Partial<Omit<SessionInfo, 'id' | 'created_at'>>): SessionInfo {
    const existing = this.getSession(id);
    if (!existing) throw new Error(`Session not found: ${id}`);

    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: unknown[] = [];

    const fields: Array<keyof typeof patch> = ['title', 'provider_id', 'model_id', 'agent_id', 'mode', 'squad_id'];
    for (const field of fields) {
      if (patch[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(patch[field]);
      }
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    this.db.prepare(`UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return this.getSession(id)!;
  }

  deleteSession(id: string): void {
    // messages cascade-delete via FK ON DELETE CASCADE
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  // ── Message persistence ─────────────────────────────────────────────────────

  addMessage(sessionId: string, msg: AddMessageOpts): MessageInfo {
    // Verify session exists
    const session = this.getSession(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const id = randomUUID();
    const now = new Date().toISOString();
    const contentJson = stringToContentJson(msg.content);

    this.db.prepare(`
      INSERT INTO messages
        (id, session_id, role, agent_id, content, tokens_input, tokens_output, cost, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      sessionId,
      msg.role,
      msg.agent_id ?? '',
      contentJson,
      msg.tokens_in ?? 0,
      msg.tokens_out ?? 0,
      msg.cost ?? 0,
      now,
    );

    // Touch session updated_at
    this.db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);

    return {
      id,
      session_id: sessionId,
      role: msg.role,
      content: msg.content,
      agent_id: msg.agent_id ?? '',
      tool_name: msg.tool_name ?? '',
      tool_input: msg.tool_input ?? '',
      tool_result: msg.tool_result ?? '',
      tokens_in: msg.tokens_in ?? 0,
      tokens_out: msg.tokens_out ?? 0,
      cost: msg.cost ?? 0,
      created_at: now,
    };
  }

  getMessages(
    sessionId: string,
    opts: { limit?: number; offset?: number } = {},
  ): MessageInfo[] {
    const limit = opts.limit ?? 1000;
    const offset = opts.offset ?? 0;

    const rows = this.db.prepare(`
      SELECT * FROM messages
      WHERE session_id = ?
      ORDER BY created_at ASC
      LIMIT ? OFFSET ?
    `).all(sessionId, limit, offset) as MessageRow[];

    return rows.map(rowToMessageInfo);
  }

  getSessionWithMessages(id: string): { session: SessionInfo; messages: MessageInfo[] } {
    const session = this.getSession(id);
    if (!session) throw new Error(`Session not found: ${id}`);
    const messages = this.getMessages(id);
    return { session, messages };
  }

  /**
   * compactSession — trims old messages to keep context windows manageable.
   *
   * Strategy: when the session exceeds COMPACT_MIN_TOTAL messages, delete all
   * but the COMPACT_KEEP_LAST most recent.  A synthetic "system" compaction
   * notice is prepended so the LLM knows history was trimmed.
   */
  compactSession(id: string): void {
    const session = this.getSession(id);
    if (!session) throw new Error(`Session not found: ${id}`);

    const countRow = this.db.prepare(
      'SELECT COUNT(*) as cnt FROM messages WHERE session_id = ?',
    ).get(id) as { cnt: number };

    if (countRow.cnt <= COMPACT_MIN_TOTAL) return; // nothing to compact

    // Find the cutoff — keep only the last COMPACT_KEEP_LAST messages
    const cutoffRow = this.db.prepare(`
      SELECT created_at FROM messages
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT 1 OFFSET ?
    `).get(id, COMPACT_KEEP_LAST - 1) as { created_at: string } | undefined;

    if (!cutoffRow) return;

    const deletedCount = (this.db.prepare(`
      SELECT COUNT(*) as cnt FROM messages
      WHERE session_id = ? AND created_at < ?
    `).get(id, cutoffRow.created_at) as { cnt: number }).cnt;

    if (deletedCount === 0) return;

    // Delete old messages
    this.db.prepare(`
      DELETE FROM messages WHERE session_id = ? AND created_at < ?
    `).run(id, cutoffRow.created_at);

    // Insert a system note so the model knows about compaction
    const notice = `[System: ${deletedCount} earlier messages were compacted to save context. Conversation continues from here.]`;
    const now = new Date().toISOString();
    const noticeId = randomUUID();

    this.db.prepare(`
      INSERT INTO messages (id, session_id, role, agent_id, content, tokens_input, tokens_output, cost, created_at)
      VALUES (?, ?, 'system', '', ?, 0, 0, 0, ?)
    `).run(noticeId, id, stringToContentJson(notice), now);

    // Re-order: the notice should appear BEFORE the kept messages.
    // We achieve this by giving it a timestamp just before the oldest kept message.
    const oldestKeptRow = this.db.prepare(`
      SELECT created_at FROM messages
      WHERE session_id = ? AND id != ?
      ORDER BY created_at ASC
      LIMIT 1
    `).get(id, noticeId) as { created_at: string } | undefined;

    if (oldestKeptRow) {
      const beforeTs = new Date(new Date(oldestKeptRow.created_at).getTime() - 1).toISOString();
      this.db.prepare('UPDATE messages SET created_at = ? WHERE id = ?').run(beforeTs, noticeId);
    }
  }

  // ── Session Restore ──────────────────────────────────────────────────────────

  /** Get the most recent session for an agent */
  getLatestSessionForAgent(agentId: string): SessionInfo | null {
    const row = this.db.prepare(
      'SELECT * FROM sessions WHERE agent_id = ? ORDER BY updated_at DESC LIMIT 1',
    ).get(agentId) as SessionRow | undefined;
    return row ? rowToSessionInfo(row) : null;
  }

  // ── Smart Context Window ────────────────────────────────────────────────────

  /** Token-aware compaction with heuristic summarization. */
  smartCompact(sessionId: string, maxTokens = 80_000): void {
    if (!this.getSession(sessionId)) return;
    const allMessages = this.getMessages(sessionId, { limit: 100_000 });
    if (allMessages.length === 0) return;

    const totalApproxTokens = allMessages.reduce((s, m) => s + Math.ceil(m.content.length / 4), 0);
    if (totalApproxTokens <= maxTokens) return;

    const cutIndex = Math.ceil(allMessages.length * 0.6);
    if (cutIndex <= 1) return;
    const oldMessages = allMessages.slice(0, cutIndex);
    const keptMessages = allMessages.slice(cutIndex);

    // Heuristic summary extraction
    const codeFiles = new Set<string>();
    const decisions = new Set<string>();
    const topics = new Set<string>();
    const codeExts = /\.(ts|js|py|tsx|jsx|json|md|yaml|yml|sql|sh|css|html)$/;

    for (const msg of oldMessages) {
      const text = msg.content;
      if (!text) continue;
      const fileMatches = text.match(/[\w/.-]+\.\w{1,10}/g);
      if (fileMatches) for (const f of fileMatches) { if (codeExts.test(f)) codeFiles.add(f); }
      for (const s of text.split(/[.!?\n]+/).filter(s => s.trim().length > 10)) {
        const lo = s.toLowerCase();
        if (/decid|decision|agreed|will use|chosen|approach/.test(lo)) decisions.add(s.trim().slice(0, 200));
      }
      if (msg.role === 'user' || msg.role === 'assistant') {
        for (const w of text.slice(0, 500).split(/\s+/).filter(w => w.length > 5).slice(0, 5)) {
          topics.add(w.replace(/[^a-zA-Z0-9_-]/g, ''));
        }
      }
    }

    const parts: string[] = [`Compacted ${oldMessages.length} messages (~${Math.ceil(
      oldMessages.reduce((s, m) => s + m.content.length / 4, 0))} tokens).`];
    if (codeFiles.size > 0) parts.push(`Files: ${[...codeFiles].slice(0, 20).join(', ')}`);
    if (decisions.size > 0) parts.push(`Decisions: ${[...decisions].slice(0, 10).join('; ')}`);
    if (topics.size > 0) parts.push(`Topics: ${[...topics].slice(0, 15).join(', ')}`);

    // Delete old messages
    const placeholders = oldMessages.map(() => '?').join(',');
    this.db.prepare(`DELETE FROM messages WHERE id IN (${placeholders})`).run(...oldMessages.map(m => m.id));

    // Insert summary before earliest kept message
    const beforeTs = keptMessages.length > 0
      ? new Date(new Date(keptMessages[0].created_at).getTime() - 1).toISOString()
      : new Date().toISOString();
    this.db.prepare(`
      INSERT INTO messages (id, session_id, role, agent_id, content, tokens_input, tokens_output, cost, created_at)
      VALUES (?, ?, 'system', '', ?, 0, 0, 0, ?)
    `).run(randomUUID(), sessionId, stringToContentJson(`[Context Summary: ${parts.join(' | ')}]`), beforeTs);
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  close(): void {
    this.db.close();
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let managerInstance: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!managerInstance) managerInstance = new SessionManager();
  return managerInstance;
}
