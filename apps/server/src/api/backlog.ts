import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/schema.js';
import { randomBytes } from 'crypto';

// ─── B056: Backlog / Kanban API ───────────────────────────────────────────────
// Tasks live in the existing `tasks` table.
// Status: todo → doing → review → done

interface Task {
  id: string;
  session_id: string | null;
  squad_id: string | null;
  title: string;
  description: string;
  status: 'todo' | 'doing' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assigned_agent_id: string | null;
  tags: string; // JSON array
  sort_order: number;
  source_message_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function uuid(): string {
  return crypto.randomUUID?.() ?? randomBytes(16).toString('hex');
}

export function registerBacklogRoutes(app: FastifyInstance): void {
  // GET /backlog — list all tasks, optionally filtered by status/squad
  app.get<{
    Querystring: { status?: string; squad_id?: string; session_id?: string }
  }>('/backlog', async (req) => {
    const db = getDb();
    const { status, squad_id, session_id } = req.query;
    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params: unknown[] = [];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (squad_id) { sql += ' AND squad_id = ?'; params.push(squad_id); }
    if (session_id) { sql += ' AND session_id = ?'; params.push(session_id); }
    sql += ' ORDER BY status, sort_order, created_at DESC';
    const tasks = db.prepare(sql).all(...params) as Task[];
    // Group by status for Kanban view
    const columns = { todo: [] as Task[], doing: [] as Task[], review: [] as Task[], done: [] as Task[] };
    for (const t of tasks) {
      const col = t.status as keyof typeof columns;
      if (columns[col]) columns[col].push(t);
    }
    return { data: { tasks, columns } };
  });

  // GET /backlog/:id — single task
  app.get<{ Params: { id: string } }>('/backlog/:id', async (req, reply) => {
    const db = getDb();
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Task | undefined;
    if (!task) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    return { data: task };
  });

  // POST /backlog — create task
  app.post<{
    Body: {
      title: string;
      description?: string;
      status?: string;
      priority?: string;
      squad_id?: string;
      session_id?: string;
      assigned_agent_id?: string;
      tags?: string[];
      source_message_id?: string;
    }
  }>('/backlog', async (req, reply) => {
    const db = getDb();
    const { title, description, status, priority, squad_id, session_id, assigned_agent_id, tags, source_message_id } = req.body ?? {};
    if (!title?.trim()) return reply.status(400).send({ error: { code: 'VALIDATION', message: 'title required' } });
    const id = uuid();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO tasks (id, title, description, status, priority, squad_id, session_id, assigned_agent_id, tags, source_message_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      title.trim(),
      description ?? '',
      status ?? 'todo',
      priority ?? 'medium',
      squad_id ?? null,
      session_id ?? null,
      assigned_agent_id ?? null,
      JSON.stringify(tags ?? []),
      source_message_id ?? null,
      now, now,
    );
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task;
    return { data: task };
  });

  // PATCH /backlog/:id — update task (status, title, priority, etc.)
  app.patch<{
    Params: { id: string };
    Body: Partial<{
      title: string;
      description: string;
      status: string;
      priority: string;
      assigned_agent_id: string;
      tags: string[];
      sort_order: number;
    }>;
  }>('/backlog/:id', async (req, reply) => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Task | undefined;
    if (!existing) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Task not found' } });

    const { title, description, status, priority, assigned_agent_id, tags, sort_order } = req.body ?? {};
    const now = new Date().toISOString();
    const completedAt = status === 'done' && existing.status !== 'done' ? now : existing.completed_at;

    db.prepare(`
      UPDATE tasks SET
        title = ?, description = ?, status = ?, priority = ?,
        assigned_agent_id = ?, tags = ?, sort_order = ?,
        completed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(
      title ?? existing.title,
      description ?? existing.description,
      status ?? existing.status,
      priority ?? existing.priority,
      assigned_agent_id ?? existing.assigned_agent_id,
      tags ? JSON.stringify(tags) : existing.tags,
      sort_order ?? existing.sort_order,
      completedAt,
      now,
      req.params.id,
    );
    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Task;
    return { data: updated };
  });

  // DELETE /backlog/:id — delete task
  app.delete<{ Params: { id: string } }>('/backlog/:id', async (req, reply) => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id) as Task | undefined;
    if (!existing) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    return { data: { success: true } };
  });
}
