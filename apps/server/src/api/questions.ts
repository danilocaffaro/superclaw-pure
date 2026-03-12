import type { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';

interface QuestionRow {
  id: string;
  question: string;
  options: string | null;
  answer: string | null;
  status: string;
  created_at: string;
}

export async function questionRoutes(app: FastifyInstance) {
  const db = new Database(join(homedir(), '.superclaw', 'superclaw.db'));

  // Ensure questions table exists
  db.exec(`CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    options TEXT DEFAULT NULL,
    answer TEXT DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const parseQuestion = (row: QuestionRow) => ({
    ...row,
    options: (() => {
      if (!row.options) return null;
      try { return JSON.parse(row.options); } catch { return row.options; }
    })(),
  });

  // GET /questions/:id — get question by id (any status)
  app.get<{ Params: { id: string } }>('/questions/:id', async (req, reply) => {
    try {
      const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(req.params.id) as QuestionRow | undefined;
      if (!row) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Question not found' } });
      }
      return { data: parseQuestion(row) };
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: { code: 'INTERNAL', message: String(err) } });
    }
  });

  // POST /questions/:id/reply — answer a question → update status to 'answered'
  app.post<{
    Params: { id: string };
    Body: { answer: string };
  }>('/questions/:id/reply', async (req, reply) => {
    try {
      const { id } = req.params;
      const { answer } = req.body;

      if (!answer) {
        return reply.status(400).send({ error: { code: 'VALIDATION', message: 'answer is required' } });
      }

      const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(id) as QuestionRow | undefined;
      if (!row) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Question not found' } });
      }
      if (row.status !== 'pending') {
        return reply.status(409).send({ error: { code: 'CONFLICT', message: `Question is already '${row.status}'` } });
      }

      db.prepare(
        "UPDATE questions SET answer = ?, status = 'answered' WHERE id = ?"
      ).run(answer, id);

      const updated = db.prepare('SELECT * FROM questions WHERE id = ?').get(id) as QuestionRow;
      return { data: parseQuestion(updated) };
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: { code: 'INTERNAL', message: String(err) } });
    }
  });

  // POST /questions/:id/reject — update status to 'rejected'
  app.post<{ Params: { id: string } }>('/questions/:id/reject', async (req, reply) => {
    try {
      const { id } = req.params;
      const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(id) as QuestionRow | undefined;
      if (!row) {
        return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Question not found' } });
      }
      if (row.status !== 'pending') {
        return reply.status(409).send({ error: { code: 'CONFLICT', message: `Question is already '${row.status}'` } });
      }

      db.prepare("UPDATE questions SET status = 'rejected' WHERE id = ?").run(id);

      const updated = db.prepare('SELECT * FROM questions WHERE id = ?').get(id) as QuestionRow;
      return { data: parseQuestion(updated) };
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: { code: 'INTERNAL', message: String(err) } });
    }
  });
}
