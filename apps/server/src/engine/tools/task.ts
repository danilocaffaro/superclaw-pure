import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import type { Tool, ToolInput, ToolOutput, ToolDefinition } from './types.js';

const DB_DIR = join(homedir(), '.superclaw');
const DB_PATH = join(DB_DIR, 'superclaw.db');

function getDb(): Database.Database {
  mkdirSync(DB_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT,
      status      TEXT NOT NULL DEFAULT 'todo',
      priority    TEXT NOT NULL DEFAULT 'medium',
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    )
  `);
  return db;
}

export class TaskTool implements Tool {
  readonly definition: ToolDefinition = {
    name: 'task',
    description: 'Manage tasks (create, list, update, delete). Persistent storage via SQLite.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'create', 'update', 'delete'],
          description: 'Action to perform',
        },
        id: { type: 'string', description: 'Task ID (required for update/delete)' },
        title: { type: 'string', description: 'Task title (required for create)' },
        description: { type: 'string', description: 'Task description' },
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'done', 'cancelled'],
          description: 'Task status',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Task priority',
        },
        filter_status: {
          type: 'string',
          description: 'Filter tasks by status when listing',
        },
      },
      required: ['action'],
    },
  };

  async execute(input: ToolInput): Promise<ToolOutput> {
    const action = input['action'] as string;

    try {
      const db = getDb();

      switch (action) {
        case 'list': {
          const filterStatus = input['filter_status'] as string | undefined;
          let rows;
          if (filterStatus) {
            rows = db.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC').all(filterStatus);
          } else {
            rows = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
          }
          return { success: true, result: rows };
        }

        case 'create': {
          const title = input['title'] as string;
          if (!title) return { success: false, error: 'title is required for create' };
          const now = new Date().toISOString();
          const id = randomUUID();
          db.prepare(`
            INSERT INTO tasks (id, title, description, status, priority, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            id,
            title,
            (input['description'] as string | undefined) ?? null,
            (input['status'] as string | undefined) ?? 'todo',
            (input['priority'] as string | undefined) ?? 'medium',
            now,
            now,
          );
          return { success: true, result: { id, message: `Task created: ${title}` } };
        }

        case 'update': {
          const id = input['id'] as string;
          if (!id) return { success: false, error: 'id is required for update' };
          const now = new Date().toISOString();
          const fields: string[] = [];
          const values: unknown[] = [];
          if (input['title'] !== undefined) { fields.push('title = ?'); values.push(input['title']); }
          if (input['description'] !== undefined) { fields.push('description = ?'); values.push(input['description']); }
          if (input['status'] !== undefined) { fields.push('status = ?'); values.push(input['status']); }
          if (input['priority'] !== undefined) { fields.push('priority = ?'); values.push(input['priority']); }
          if (fields.length === 0) return { success: false, error: 'No fields to update' };
          fields.push('updated_at = ?');
          values.push(now, id);
          const result = db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
          if (result.changes === 0) return { success: false, error: `Task not found: ${id}` };
          return { success: true, result: `Task updated: ${id}` };
        }

        case 'delete': {
          const id = input['id'] as string;
          if (!id) return { success: false, error: 'id is required for delete' };
          const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
          if (result.changes === 0) return { success: false, error: `Task not found: ${id}` };
          return { success: true, result: `Task deleted: ${id}` };
        }

        default:
          return { success: false, error: `Unknown action: ${action}. Use list, create, update, or delete.` };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  }
}
