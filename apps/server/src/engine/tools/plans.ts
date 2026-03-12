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
    CREATE TABLE IF NOT EXISTS plans (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      content    TEXT,
      status     TEXT NOT NULL DEFAULT 'active',
      tags       TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )
  `);
  return db;
}

type PlanRow = Record<string, unknown>;

function parsePlan(row: PlanRow): PlanRow {
  return { ...row, tags: JSON.parse(row['tags'] as string) };
}

export class PlansTool implements Tool {
  readonly definition: ToolDefinition = {
    name: 'plans',
    description: 'Manage plans — structured documents for projects, strategies, or any multi-step work. Supports CRUD + soft-delete.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'create', 'get', 'update', 'delete'],
          description: 'Action to perform',
        },
        id: { type: 'string', description: 'Plan ID (required for get/update/delete)' },
        title: { type: 'string', description: 'Plan title (required for create)' },
        content: { type: 'string', description: 'Plan content / body text' },
        status: {
          type: 'string',
          enum: ['active', 'paused', 'completed', 'cancelled'],
          description: 'Plan status',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for the plan',
        },
        filter_status: {
          type: 'string',
          description: 'Filter by status when listing (default: active)',
        },
        include_deleted: {
          type: 'boolean',
          description: 'Include soft-deleted plans when listing',
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
          const includeDeleted = (input['include_deleted'] as boolean | undefined) ?? false;
          let rows: PlanRow[];
          if (filterStatus) {
            rows = db
              .prepare(`SELECT * FROM plans WHERE status = ? ${includeDeleted ? '' : 'AND deleted_at IS NULL'} ORDER BY created_at DESC`)
              .all(filterStatus) as PlanRow[];
          } else {
            rows = db
              .prepare(`SELECT * FROM plans ${includeDeleted ? '' : 'WHERE deleted_at IS NULL'} ORDER BY created_at DESC`)
              .all() as PlanRow[];
          }
          return { success: true, result: rows.map(parsePlan) };
        }

        case 'create': {
          const title = input['title'] as string;
          if (!title) return { success: false, error: 'title is required for create' };
          const id = randomUUID();
          const now = new Date().toISOString();
          const tags = JSON.stringify(Array.isArray(input['tags']) ? input['tags'] : []);
          db.prepare(`
            INSERT INTO plans (id, title, content, status, tags, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            id,
            title,
            (input['content'] as string | undefined) ?? null,
            (input['status'] as string | undefined) ?? 'active',
            tags,
            now,
            now,
          );
          return { success: true, result: { id, message: `Plan created: ${title}` } };
        }

        case 'get': {
          const id = input['id'] as string;
          if (!id) return { success: false, error: 'id is required for get' };
          const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as PlanRow | undefined;
          if (!row) return { success: false, error: `Plan not found: ${id}` };
          return { success: true, result: parsePlan(row) };
        }

        case 'update': {
          const id = input['id'] as string;
          if (!id) return { success: false, error: 'id is required for update' };
          const now = new Date().toISOString();
          const fields: string[] = [];
          const values: unknown[] = [];
          if (input['title'] !== undefined) { fields.push('title = ?'); values.push(input['title']); }
          if (input['content'] !== undefined) { fields.push('content = ?'); values.push(input['content']); }
          if (input['status'] !== undefined) { fields.push('status = ?'); values.push(input['status']); }
          if (input['tags'] !== undefined) {
            fields.push('tags = ?');
            values.push(JSON.stringify(Array.isArray(input['tags']) ? input['tags'] : []));
          }
          if (fields.length === 0) return { success: false, error: 'No fields to update' };
          fields.push('updated_at = ?');
          values.push(now, id);
          const result = db.prepare(`UPDATE plans SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`).run(...values);
          if (result.changes === 0) return { success: false, error: `Plan not found or already deleted: ${id}` };
          return { success: true, result: `Plan updated: ${id}` };
        }

        case 'delete': {
          const id = input['id'] as string;
          if (!id) return { success: false, error: 'id is required for delete' };
          const now = new Date().toISOString();
          const result = db.prepare('UPDATE plans SET deleted_at = ?, status = ? WHERE id = ? AND deleted_at IS NULL').run(now, 'cancelled', id);
          if (result.changes === 0) return { success: false, error: `Plan not found or already deleted: ${id}` };
          return { success: true, result: `Plan soft-deleted: ${id}` };
        }

        default:
          return { success: false, error: `Unknown action: ${action}. Use list, create, get, update, or delete.` };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  }
}
