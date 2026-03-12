import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

export interface Task {
  id: string;
  sessionId: string | null;
  squadId: string | null;
  title: string;
  description: string;
  status: 'todo' | 'doing' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedAgentId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  tags: string[];
  sortOrder: number;
}

export class TaskRepository {
  constructor(private db: Database.Database) {}

  list(filters?: { sessionId?: string; squadId?: string; status?: string }): Task[] {
    let sql = 'SELECT * FROM tasks';
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.sessionId) { conditions.push('session_id = ?'); params.push(filters.sessionId); }
    if (filters?.squadId)   { conditions.push('squad_id = ?');   params.push(filters.squadId); }
    if (filters?.status)    { conditions.push('status = ?');      params.push(filters.status); }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY sort_order ASC, created_at DESC';

    return (this.db.prepare(sql).all(...params) as Record<string, unknown>[]).map(this.rowToTask);
  }

  getById(id: string): Task | undefined {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToTask(row) : undefined;
  }

  create(data: Partial<Task> & { title: string }): Task {
    const id = data.id || randomUUID();
    this.db.prepare(
      `INSERT INTO tasks (id, session_id, squad_id, title, description, status, priority, assigned_agent_id, tags, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      data.sessionId    ?? null,
      data.squadId      ?? null,
      data.title,
      data.description  ?? '',
      data.status       ?? 'todo',
      data.priority     ?? 'medium',
      data.assignedAgentId ?? null,
      JSON.stringify(data.tags ?? []),
      data.sortOrder    ?? 0
    );
    return this.getById(id)!;
  }

  update(id: string, patch: Partial<Task>): Task {
    const existing = this.getById(id);
    if (!existing) throw new Error(`Task not found: ${id}`);

    const updates: string[] = ["updated_at = datetime('now')"];
    const params: unknown[] = [];

    if (patch.title !== undefined)           { updates.push('title = ?');              params.push(patch.title); }
    if (patch.description !== undefined)     { updates.push('description = ?');         params.push(patch.description); }
    if (patch.status !== undefined) {
      updates.push('status = ?');
      params.push(patch.status);
      if (patch.status === 'done') { updates.push("completed_at = datetime('now')"); }
    }
    if (patch.priority !== undefined)        { updates.push('priority = ?');            params.push(patch.priority); }
    if (patch.assignedAgentId !== undefined) { updates.push('assigned_agent_id = ?');   params.push(patch.assignedAgentId); }
    if (patch.tags !== undefined)            { updates.push('tags = ?');                params.push(JSON.stringify(patch.tags)); }
    if (patch.sortOrder !== undefined)       { updates.push('sort_order = ?');          params.push(patch.sortOrder); }

    params.push(id);
    this.db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    return this.getById(id)!;
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private rowToTask(row: Record<string, unknown>): Task {
    return {
      id:              row.id as string,
      sessionId:       (row.session_id as string | null) ?? null,
      squadId:         (row.squad_id as string | null) ?? null,
      title:           row.title as string,
      description:     (row.description as string) || '',
      status:          row.status as Task['status'],
      priority:        row.priority as Task['priority'],
      assignedAgentId: (row.assigned_agent_id as string | null) ?? null,
      createdAt:       row.created_at as string,
      updatedAt:       row.updated_at as string,
      completedAt:     (row.completed_at as string | null) ?? null,
      tags:            JSON.parse((row.tags as string) || '[]') as string[],
      sortOrder:       (row.sort_order as number) || 0,
    };
  }
}
