import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import type { Tool, ToolInput, ToolOutput, ToolDefinition } from './types.js';

const DB_DIR = join(homedir(), '.hiveclaw');
const DB_PATH = join(DB_DIR, 'hiveclaw.db');

function getDb(): Database.Database {
  mkdirSync(DB_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id         TEXT PRIMARY KEY,
      content    TEXT NOT NULL,
      completed  INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);
  return db;
}

export class TodoTool implements Tool {
  readonly definition: ToolDefinition = {
    name: 'todo',
    description: 'Simple todo list manager — add, list, complete, and delete todos.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'add', 'complete', 'delete'],
          description: 'Action to perform',
        },
        id: { type: 'string', description: 'Todo ID (required for complete/delete)' },
        content: { type: 'string', description: 'Todo text content (required for add)' },
        show_completed: {
          type: 'boolean',
          description: 'Include completed todos when listing (default false)',
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
          const showCompleted = (input['show_completed'] as boolean | undefined) ?? false;
          const rows = showCompleted
            ? db.prepare('SELECT * FROM todos ORDER BY created_at DESC').all()
            : db.prepare('SELECT * FROM todos WHERE completed = 0 ORDER BY created_at DESC').all();
          return { success: true, result: rows };
        }

        case 'add': {
          const content = input['content'] as string;
          if (!content) return { success: false, error: 'content is required for add' };
          const id = randomUUID();
          const now = new Date().toISOString();
          db.prepare('INSERT INTO todos (id, content, completed, created_at) VALUES (?, ?, 0, ?)').run(id, content, now);
          return { success: true, result: { id, message: `Todo added: "${content}"` } };
        }

        case 'complete': {
          const id = input['id'] as string;
          if (!id) return { success: false, error: 'id is required for complete' };
          const result = db.prepare('UPDATE todos SET completed = 1 WHERE id = ?').run(id);
          if (result.changes === 0) return { success: false, error: `Todo not found: ${id}` };
          return { success: true, result: `Todo marked complete: ${id}` };
        }

        case 'delete': {
          const id = input['id'] as string;
          if (!id) return { success: false, error: 'id is required for delete' };
          const result = db.prepare('DELETE FROM todos WHERE id = ?').run(id);
          if (result.changes === 0) return { success: false, error: `Todo not found: ${id}` };
          return { success: true, result: `Todo deleted: ${id}` };
        }

        default:
          return { success: false, error: `Unknown action: ${action}. Use list, add, complete, or delete.` };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  }
}
