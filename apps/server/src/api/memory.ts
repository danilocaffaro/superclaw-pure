import type { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { homedir } from 'os';

interface MemoryRow {
  id: string;
  type: string;
  content: string;
  tags: string;
  created_at: string;
}

export async function memoryRoutes(app: FastifyInstance) {
  const db = new Database(join(homedir(), '.superclaw', 'superclaw.db'));

  // Ensure memories table exists
  db.exec(`CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'fact',
    content TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const parseMemory = (row: MemoryRow) => ({
    ...row,
    tags: (() => { try { return JSON.parse(row.tags); } catch { return []; } })(),
  });

  // GET /memory — list all, with optional ?type= and ?search= filters
  app.get<{
    Querystring: { type?: string; search?: string };
  }>('/memory', async (req, reply) => {
    try {
      const { type, search } = req.query;
      let query = 'SELECT * FROM memories';
      const params: string[] = [];
      const conditions: string[] = [];

      if (type) {
        conditions.push('type = ?');
        params.push(type);
      }
      if (search) {
        conditions.push('(content LIKE ? OR tags LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY created_at DESC';

      const rows = db.prepare(query).all(...params) as MemoryRow[];
      return { data: rows.map(parseMemory) };
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: { code: 'INTERNAL', message: String(err) } });
    }
  });

  // GET /memory/types — return {types: {fact: N, decision: N, ...}, total: N}
  app.get('/memory/types', async (_req, reply) => {
    try {
      const rows = db.prepare('SELECT type, COUNT(*) as count FROM memories GROUP BY type').all() as { type: string; count: number }[];
      const types: Record<string, number> = {};
      let total = 0;
      for (const row of rows) {
        types[row.type] = row.count;
        total += row.count;
      }
      return { data: { types, total } };
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: { code: 'INTERNAL', message: String(err) } });
    }
  });

  // POST /memory — create {type, content, tags?} → memory object
  app.post<{
    Body: { type?: string; content: string; tags?: string[] };
  }>('/memory', async (req, reply) => {
    try {
      const { type = 'fact', content, tags = [] } = req.body;
      if (!content) {
        return reply.status(400).send({ error: { code: 'VALIDATION', message: 'content is required' } });
      }
      const id = randomUUID();
      const tagsJson = JSON.stringify(tags);
      db.prepare(
        'INSERT INTO memories (id, type, content, tags) VALUES (?, ?, ?, ?)'
      ).run(id, type, content, tagsJson);

      const row = db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as MemoryRow;
      return reply.status(201).send({ data: parseMemory(row) });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: { code: 'INTERNAL', message: String(err) } });
    }
  });

  // DELETE /memory/:id — delete by id → {success: true}
  app.delete<{ Params: { id: string } }>('/memory/:id', async (req, reply) => {
    try {
      const { id } = req.params;
      const existing = db.prepare('SELECT id FROM memories WHERE id = ?').get(id);
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Memory not found' } });
      }
      db.prepare('DELETE FROM memories WHERE id = ?').run(id);
      return { data: { success: true } };
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: { code: 'INTERNAL', message: String(err) } });
    }
  });
}
