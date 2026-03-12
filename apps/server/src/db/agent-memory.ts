import { v4 as uuid } from 'uuid';
import type Database from 'better-sqlite3';

export type MemoryType = 'short_term' | 'long_term' | 'entity' | 'preference';

export interface MemoryEntry {
  id: string;
  agent_id: string;
  type: MemoryType;
  key: string;
  value: string;
  relevance: number;
  created_at: string;
  expires_at: string | null;
}

/** Create a typed error Fastify can serialise */
function dbError(err: unknown): never {
  const msg = err instanceof Error ? err.message : 'Database error';
  throw Object.assign(new Error(msg), { statusCode: 500, code: 'DB_ERROR' });
}

export class AgentMemoryRepository {
  constructor(private db: Database.Database) {}

  /** Ensure a stub agent row exists so FK constraint is satisfied for Bridge agents */
  private ensureAgent(agentId: string): void {
    const exists = this.db.prepare('SELECT id FROM agents WHERE id = ?').get(agentId);
    if (!exists) {
      try {
        this.db
          .prepare(`INSERT OR IGNORE INTO agents (id, name, emoji, role, type, system_prompt, color, skills, model_preference, created_at, updated_at)
                    VALUES (?, ?, '🤖', 'assistant', 'specialist', '', NULL, '[]', '', datetime('now'), datetime('now'))`)
          .run(agentId, agentId);
      } catch { /* ignore — may fail if schema differs */ }
    }
  }

  /** Store a memory (upsert by agent+type+key) */
  set(
    agentId: string,
    key: string,
    value: string,
    type: MemoryType = 'short_term',
    relevance = 1.0,
    expiresAt?: string,
  ): MemoryEntry {
    try {
      this.ensureAgent(agentId); // auto-create stub if Bridge agent
      const id = uuid();
      const now = new Date().toISOString();

      // Upsert: if same agent+type+key exists, update it
      const existing = this.db
        .prepare('SELECT id FROM agent_memory WHERE agent_id = ? AND type = ? AND key = ?')
        .get(agentId, type, key) as { id: string } | undefined;

      if (existing) {
        this.db
          .prepare('UPDATE agent_memory SET value = ?, relevance = ?, expires_at = ? WHERE id = ?')
          .run(value, relevance, expiresAt ?? null, existing.id);
        return this.get(existing.id)!;
      }

      this.db
        .prepare(
          `INSERT INTO agent_memory (id, agent_id, type, key, value, relevance, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(id, agentId, type, key, value, relevance, now, expiresAt ?? null);

      return {
        id,
        agent_id: agentId,
        type,
        key,
        value,
        relevance,
        created_at: now,
        expires_at: expiresAt ?? null,
      };
    } catch (err) {
      dbError(err);
    }
  }

  /** Get by ID */
  get(id: string): MemoryEntry | undefined {
    try {
      return this.db
        .prepare('SELECT * FROM agent_memory WHERE id = ?')
        .get(id) as MemoryEntry | undefined;
    } catch (err) {
      dbError(err);
    }
  }

  /** List memories for an agent */
  list(
    agentId: string,
    opts?: { type?: MemoryType; limit?: number; search?: string },
  ): MemoryEntry[] {
    try {
      let sql = 'SELECT * FROM agent_memory WHERE agent_id = ?';
      const params: unknown[] = [agentId];

      // Filter out expired
      sql += " AND (expires_at IS NULL OR expires_at > datetime('now'))";

      if (opts?.type) {
        sql += ' AND type = ?';
        params.push(opts.type);
      }
      if (opts?.search) {
        sql += ' AND (key LIKE ? OR value LIKE ?)';
        params.push(`%${opts.search}%`, `%${opts.search}%`);
      }

      sql += ' ORDER BY relevance DESC, created_at DESC';

      if (opts?.limit) {
        sql += ' LIMIT ?';
        params.push(opts.limit);
      }

      return this.db.prepare(sql).all(...params) as MemoryEntry[];
    } catch (err) {
      dbError(err);
    }
  }

  /** Delete a memory */
  delete(id: string): boolean {
    try {
      const result = this.db.prepare('DELETE FROM agent_memory WHERE id = ?').run(id);
      return result.changes > 0;
    } catch (err) {
      dbError(err);
    }
  }

  /** Clear all memories for an agent */
  clearAgent(agentId: string, type?: MemoryType): number {
    try {
      if (type) {
        return this.db
          .prepare('DELETE FROM agent_memory WHERE agent_id = ? AND type = ?')
          .run(agentId, type).changes;
      }
      return this.db
        .prepare('DELETE FROM agent_memory WHERE agent_id = ?')
        .run(agentId).changes;
    } catch (err) {
      dbError(err);
    }
  }

  /** Prune expired entries */
  prune(): number {
    try {
      return this.db
        .prepare(
          "DELETE FROM agent_memory WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')",
        )
        .run().changes;
    } catch (err) {
      dbError(err);
    }
  }

  /** Search memories across all agents by query string */
  search(query: string, limit = 20): MemoryEntry[] {
    try {
      const pattern = `%${query}%`;
      return this.db
        .prepare(
          `SELECT * FROM agent_memory
           WHERE (value LIKE ? OR key LIKE ?)
             AND (expires_at IS NULL OR expires_at > datetime('now'))
           ORDER BY relevance DESC, created_at DESC
           LIMIT ?`,
        )
        .all(pattern, pattern, limit) as MemoryEntry[];
    } catch (err) {
      dbError(err);
    }
  }

  /** Get memory context string for injection into agent prompt */
  getContextString(agentId: string, maxEntries = 20): string {
    try {
      const memories = this.list(agentId, { limit: maxEntries });
      if (memories.length === 0) return '';

      const grouped: Record<string, MemoryEntry[]> = {};
      for (const m of memories) {
        (grouped[m.type] ??= []).push(m);
      }

      let context = '\n\n--- Agent Memory ---\n';
      for (const [type, entries] of Object.entries(grouped)) {
        context += `\n[${type}]\n`;
        for (const e of entries) {
          context += `- ${e.key}: ${e.value}\n`;
        }
      }
      return context;
    } catch (err) {
      dbError(err);
    }
  }
}
