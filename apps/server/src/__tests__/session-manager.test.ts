import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../engine/session-manager.js';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import Database from 'better-sqlite3';

/** Schema DDL extracted from schema.ts — only the tables SessionManager uses */
const SESSION_SCHEMA = `
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '', agent_id TEXT DEFAULT '',
    squad_id TEXT DEFAULT '', mode TEXT DEFAULT 'dm', provider_id TEXT DEFAULT '',
    model_id TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL, agent_id TEXT DEFAULT '', agent_name TEXT DEFAULT '', agent_emoji TEXT DEFAULT '', sender_type TEXT DEFAULT 'human',
    content TEXT NOT NULL DEFAULT '[]',
    tokens_input INTEGER DEFAULT 0, tokens_output INTEGER DEFAULT 0,
    cost REAL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent_id);
`;

let tmpDir: string;
let dbPath: string;
let mgr: SessionManager;

function freshManager(): SessionManager {
  tmpDir = mkdtempSync(join(tmpdir(), 'sc-test-'));
  dbPath = join(tmpDir, 'test.db');
  // Pre-create the DB with schema so SessionManager can use it
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SESSION_SCHEMA);
  db.close();
  return new SessionManager(dbPath);
}

describe('SessionManager', () => {
  beforeEach(() => { mgr = freshManager(); });
  afterEach(() => {
    mgr.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should create a session', () => {
    const s = mgr.createSession({ title: 'Chat 1', agent_id: 'a1' });
    expect(s.id).toBeDefined();
    expect(s.title).toBe('Chat 1');
    expect(s.agent_id).toBe('a1');
  });

  it('should list sessions', () => {
    mgr.createSession({ title: 'S1' });
    mgr.createSession({ title: 'S2' });
    const list = mgr.listSessions();
    expect(list).toHaveLength(2);
  });

  it('should add and retrieve messages', () => {
    const s = mgr.createSession({ title: 'Msg test' });
    mgr.addMessage(s.id, { role: 'user', content: 'Hello' });
    mgr.addMessage(s.id, { role: 'assistant', content: 'Hi there' });
    const msgs = mgr.getMessages(s.id);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].content).toBe('Hello');
    expect(msgs[1].content).toBe('Hi there');
  });

  it('should delete a session', () => {
    const s = mgr.createSession({ title: 'Doomed' });
    mgr.addMessage(s.id, { role: 'user', content: 'bye' });
    mgr.deleteSession(s.id);
    expect(mgr.getSession(s.id)).toBeNull();
    // Messages should cascade-delete
    expect(mgr.getMessages(s.id)).toHaveLength(0);
  });

  it('should compact a session', () => {
    const s = mgr.createSession({ title: 'Compact' });
    // Add 50 messages with distinct timestamps so compaction cutoff works
    for (let i = 0; i < 50; i++) {
      mgr.addMessage(s.id, { role: i % 2 === 0 ? 'user' : 'assistant', content: `Msg ${i}` });
    }
    // Manually stagger timestamps so they're distinct
    const db = new Database(dbPath);
    const msgs = db.prepare('SELECT id FROM messages WHERE session_id = ? ORDER BY rowid ASC').all(s.id) as { id: string }[];
    for (let i = 0; i < msgs.length; i++) {
      const ts = new Date(Date.now() - (msgs.length - i) * 1000).toISOString();
      db.prepare('UPDATE messages SET created_at = ? WHERE id = ?').run(ts, msgs[i].id);
    }
    db.close();

    expect(mgr.getMessages(s.id).length).toBe(50);
    mgr.compactSession(s.id);
    const after = mgr.getMessages(s.id);
    // Should keep COMPACT_KEEP_LAST=20 + 1 system compaction notice = 21
    expect(after.length).toBeLessThanOrEqual(21);
    expect(after.some(m => m.role === 'system' && m.content.includes('compacted'))).toBe(true);
  });

  it('should get latest session for agent', () => {
    const older = mgr.createSession({ title: 'Old', agent_id: 'bot' });
    const newer = mgr.createSession({ title: 'New', agent_id: 'bot' });
    mgr.createSession({ title: 'Other', agent_id: 'other' });
    // Ensure newer has a later updated_at
    const db = new Database(dbPath);
    db.prepare("UPDATE sessions SET updated_at = '2020-01-01T00:00:00Z' WHERE id = ?").run(older.id);
    db.prepare("UPDATE sessions SET updated_at = '2025-01-01T00:00:00Z' WHERE id = ?").run(newer.id);
    db.close();
    const latest = mgr.getLatestSessionForAgent('bot');
    expect(latest).toBeTruthy();
    expect(latest!.title).toBe('New');
  });

  it('should smart compact when over token limit', () => {
    const s = mgr.createSession({ title: 'SmartCompact' });
    // Each message ~100 chars ≈ 25 tokens. 200 messages ≈ 5000 tokens
    for (let i = 0; i < 200; i++) {
      mgr.addMessage(s.id, { role: 'user', content: 'x'.repeat(100) });
    }
    mgr.smartCompact(s.id, 1000); // very low limit to force compaction
    const after = mgr.getMessages(s.id);
    expect(after.length).toBeLessThan(200);
    expect(after.some(m => m.role === 'system' && m.content.includes('Context Summary'))).toBe(true);
  });
});
