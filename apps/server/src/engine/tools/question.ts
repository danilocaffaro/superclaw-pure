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
    CREATE TABLE IF NOT EXISTS questions (
      id         TEXT PRIMARY KEY,
      question   TEXT NOT NULL,
      options    TEXT,
      answer     TEXT,
      status     TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL
    )
  `);
  return db;
}

export class QuestionTool implements Tool {
  readonly definition: ToolDefinition = {
    name: 'question',
    description: 'Ask the user a question and store it as pending. Returns a question ID that can be used to retrieve the answer later. Also supports checking status and answering questions.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['ask', 'get', 'answer', 'list'],
          description: 'Action: "ask" to pose a new question, "get" to retrieve a question by ID, "answer" to submit an answer, "list" to list pending questions',
          default: 'ask',
        },
        question: { type: 'string', description: 'The question text (required for ask)' },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of answer choices to present to the user',
        },
        id: { type: 'string', description: 'Question ID (required for get/answer)' },
        answer: { type: 'string', description: 'Answer text (required for answer)' },
      },
      required: [],
    },
  };

  async execute(input: ToolInput): Promise<ToolOutput> {
    // Default action is 'ask' for backward compat (original spec: input has question field)
    const action = (input['action'] as string | undefined) ?? (input['question'] ? 'ask' : 'list');

    try {
      const db = getDb();

      switch (action) {
        case 'ask': {
          const questionText = input['question'] as string;
          if (!questionText) return { success: false, error: 'question is required' };
          const id = randomUUID();
          const now = new Date().toISOString();
          const options = input['options']
            ? JSON.stringify(Array.isArray(input['options']) ? input['options'] : [input['options']])
            : null;
          db.prepare(`
            INSERT INTO questions (id, question, options, answer, status, created_at)
            VALUES (?, ?, ?, NULL, 'pending', ?)
          `).run(id, questionText, options, now);
          const result: Record<string, unknown> = {
            id,
            question: questionText,
            status: 'pending',
            message: `Question stored with ID: ${id}. Awaiting user response.`,
          };
          if (options) result['options'] = JSON.parse(options);
          return { success: true, result };
        }

        case 'get': {
          const id = input['id'] as string;
          if (!id) return { success: false, error: 'id is required for get' };
          const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
          if (!row) return { success: false, error: `Question not found: ${id}` };
          return {
            success: true,
            result: {
              ...row,
              options: row['options'] ? JSON.parse(row['options'] as string) : null,
            },
          };
        }

        case 'answer': {
          const id = input['id'] as string;
          const answer = input['answer'] as string;
          if (!id) return { success: false, error: 'id is required for answer' };
          if (answer === undefined || answer === null) return { success: false, error: 'answer is required' };
          const result = db.prepare(`
            UPDATE questions SET answer = ?, status = 'answered' WHERE id = ? AND status = 'pending'
          `).run(answer, id);
          if (result.changes === 0) {
            return { success: false, error: `Question not found or already answered: ${id}` };
          }
          return { success: true, result: `Question ${id} answered.` };
        }

        case 'list': {
          const statusFilter = (input['status'] as string | undefined) ?? 'pending';
          const rows = db
            .prepare('SELECT * FROM questions WHERE status = ? ORDER BY created_at DESC')
            .all(statusFilter) as Array<Record<string, unknown>>;
          const parsed = rows.map(r => ({
            ...r,
            options: r['options'] ? JSON.parse(r['options'] as string) : null,
          }));
          return { success: true, result: parsed };
        }

        default:
          return { success: false, error: `Unknown action: ${action}. Use ask, get, answer, or list.` };
      }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  }
}
