import type { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { homedir } from 'os';

interface PlanRow {
  id: string;
  title: string;
  content: string;
  status: string;
  tags: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export async function planRoutes(app: FastifyInstance) {
  const db = new Database(join(homedir(), '.hiveclaw', 'hiveclaw.db'));

  // Ensure plans table exists
  db.exec(`CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    tags TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME DEFAULT NULL
  )`);

  const parsePlan = (row: PlanRow) => ({
    ...row,
    tags: (() => { try { return JSON.parse(row.tags); } catch { return []; } })(),
  });

  // GET /plans — list (exclude soft-deleted), with optional ?status= filter
  app.get<{
    Querystring: { status?: string };
  }>('/plans', async (req, reply) => {
    try {
      const { status } = req.query;
      let query = 'SELECT * FROM plans WHERE deleted_at IS NULL';
      const params: string[] = [];

      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }
      query += ' ORDER BY created_at DESC';

      const rows = db.prepare(query).all(...params) as PlanRow[];
      return { data: rows.map(parsePlan) };
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: { code: 'INTERNAL', message: String(err) } });
    }
  });

  // GET /plans/:id — detail
  app.get<{ Params: { id: string } }>('/plans/:id', async (req, reply) => {
    try {
      const row = db.prepare('SELECT * FROM plans WHERE id = ? AND deleted_at IS NULL').get(req.params.id) as PlanRow | undefined;
      if (!row) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Plan not found' } });
      }
      return { data: parsePlan(row) };
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: { code: 'INTERNAL', message: String(err) } });
    }
  });

  // POST /plans — create {title, content, status?, tags?}
  app.post<{
    Body: { title: string; content?: string; status?: string; tags?: string[] };
  }>('/plans', async (req, reply) => {
    try {
      const { title, content = '', status = 'active', tags = [] } = req.body;
      if (!title) {
        return reply.status(400).send({ error: { code: 'VALIDATION', message: 'title is required' } });
      }
      const id = randomUUID();
      const tagsJson = JSON.stringify(tags);
      db.prepare(
        'INSERT INTO plans (id, title, content, status, tags) VALUES (?, ?, ?, ?, ?)'
      ).run(id, title, content, status, tagsJson);

      const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as PlanRow;
      return reply.status(201).send({ data: parsePlan(row) });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: { code: 'INTERNAL', message: String(err) } });
    }
  });

  // PATCH /plans/:id — update {title?, content?, status?, tags?}
  app.patch<{
    Params: { id: string };
    Body: { title?: string; content?: string; status?: string; tags?: string[] };
  }>('/plans/:id', async (req, reply) => {
    try {
      const { id } = req.params;
      const existing = db.prepare('SELECT * FROM plans WHERE id = ? AND deleted_at IS NULL').get(id) as PlanRow | undefined;
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Plan not found' } });
      }

      const { title, content, status, tags } = req.body;
      const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
      const params: unknown[] = [];

      if (title !== undefined) { updates.push('title = ?'); params.push(title); }
      if (content !== undefined) { updates.push('content = ?'); params.push(content); }
      if (status !== undefined) { updates.push('status = ?'); params.push(status); }
      if (tags !== undefined) { updates.push('tags = ?'); params.push(JSON.stringify(tags)); }

      if (updates.length === 1) {
        return reply.status(400).send({ error: { code: 'VALIDATION', message: 'No fields to update' } });
      }

      params.push(id);
      db.prepare(`UPDATE plans SET ${updates.join(', ')} WHERE id = ?`).run(...params);

      const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as PlanRow;
      return { data: parsePlan(row) };
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: { code: 'INTERNAL', message: String(err) } });
    }
  });

  // DELETE /plans/:id — soft delete (set deleted_at)
  app.delete<{ Params: { id: string } }>('/plans/:id', async (req, reply) => {
    try {
      const { id } = req.params;
      const existing = db.prepare('SELECT id FROM plans WHERE id = ? AND deleted_at IS NULL').get(id);
      if (!existing) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Plan not found' } });
      }
      db.prepare("UPDATE plans SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
      return { data: { success: true } };
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: { code: 'INTERNAL', message: String(err) } });
    }
  });
}
