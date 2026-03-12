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
    CREATE TABLE IF NOT EXISTS memories (
      id         TEXT PRIMARY KEY,
      type       TEXT NOT NULL DEFAULT 'general',
      content    TEXT NOT NULL,
      tags       TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    )
  `);
  return db;
}

export class MemoryTool implements Tool {
  readonly definition: ToolDefinition = {
    name: 'memory',
    description: 'Store and retrieve persistent memories. Supports create, list, search (by content), and delete.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'create', 'search', 'delete'],
          description: 'Action to perform',
        },
        id: { type: 'string', description: 'Memory ID (required for delete)' },
        type: {
          type: 'string',
          description: 'Memory type/category, e.g. "fact", "preference", "note" (default: "general")',
        },
        content: { type: 'string', description: 'Memory content (required for create/search)' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for the memory (optional, for create)',
        },
        query: {
          type: 'string',
          description: 'Search query — performs LIKE match on content (required for search)',
        },
        filter_type: {
          type: 'string',
          description: 'Filter by type when listing',
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
          const filterType = input['filter_type'] as string | undefined;
          const rows = filterType
            ? db.prepare('SELECT * FROM memories WHERE type = ? ORDER BY created_at DESC').all(filterType)
            : db.prepare('SELECT * FROM memories ORDER BY created_at DESC').all();
          // Parse tags back to array
          const parsed = (rows as Array<Record<string, unknown>>).map(r => ({
            ...r,
            tags: JSON.parse(r['tags'] as string),
          }));
          return { success: true, result: parsed };
        }

        case 'create': {
          const content = input['content'] as string;
          if (!content) return { success: false, error: 'content is required for create' };
          const id = randomUUID();
          const now = new Date().toISOString();
          const tags = JSON.stringify(Array.isArray(input['tags']) ? input['tags'] : []);
          const type = (input['type'] as string | undefined) ?? 'general';
          db.prepare('INSERT INTO memories (id, type, content, tags, created_at) VALUES (?, ?, ?, ?, ?)').run(
            id, type, content, tags, now,
          );
          return { success: true, result: { id, message: `Memory stored (type: ${type})` } };
        }

        case 'search': {
          const query = (input['query'] as string | undefined) ?? (input['content'] as string | undefined);
          if (!query) return { success: false, error: 'query or content is required for search' };
          const rows = db
            .prepare('SELECT * FROM memories WHERE content LIKE ? ORDER BY created_at DESC')
            .all(`%${query}%`);
          const parsed = (rows as Array<Record<string, unknown>>).map(r => ({
            ...r,
            tags: JSON.parse(r['tags'] as string),
          }));
          return { success: true, result: parsed };
        }

        case 'delete': {
          const id = input['id'] as string;
          if (!id) return { success: false, error: 'id is required for delete' };
          const result = db.prepare('DELETE FROM memories WHERE id = ?').run(id);
          if (result.changes === 0) return { success: false, error: `Memory not found: ${id}` };
          return { success: true, result: `Memory deleted: ${id}` };
        }

        default:
          return { success: false, error: `Unknown action: ${action}. Use list, create, search, or delete.` };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  }
}
