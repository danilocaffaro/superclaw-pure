import type { FastifyInstance } from 'fastify';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { homedir } from 'os';

interface HeartbeatConfigRow {
  id: number;
  enabled: number;
  interval_minutes: number;
  last_run_id: string | null;
  created_at: string;
  updated_at: string;
}

interface HeartbeatRunRow {
  id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  result: string | null;
}

export async function heartbeatRoutes(app: FastifyInstance) {
  const db = new Database(join(homedir(), '.hiveclaw', 'hiveclaw.db'));

  // Ensure heartbeat tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS heartbeat_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1,
      interval_minutes INTEGER NOT NULL DEFAULT 60,
      last_run_id TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CHECK (id = 1)
    );

    CREATE TABLE IF NOT EXISTS heartbeat_runs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'pending',
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME DEFAULT NULL,
      result TEXT DEFAULT NULL
    );
  `);

  // Seed default config row if not present
  const existingConfig = db.prepare('SELECT id FROM heartbeat_config WHERE id = 1').get();
  if (!existingConfig) {
    db.prepare('INSERT INTO heartbeat_config (id) VALUES (1)').run();
  }

  const parseConfig = (row: HeartbeatConfigRow) => ({
    ...row,
    enabled: Boolean(row.enabled),
  });

  const parseRun = (row: HeartbeatRunRow) => ({
    ...row,
    result: (() => {
      if (!row.result) return null;
      try { return JSON.parse(row.result); } catch { return row.result; }
    })(),
  });

  // GET /heartbeat/status — config + last run info
  app.get('/heartbeat/status', async (_req, reply) => {
    try {
      const config = db.prepare('SELECT * FROM heartbeat_config WHERE id = 1').get() as HeartbeatConfigRow;
      let lastRun = null;
      if (config.last_run_id) {
        const run = db.prepare('SELECT * FROM heartbeat_runs WHERE id = ?').get(config.last_run_id) as HeartbeatRunRow | undefined;
        if (run) lastRun = parseRun(run);
      }
      return {
        data: {
          config: parseConfig(config),
          lastRun,
        },
      };
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: { code: 'INTERNAL', message: String(err) } });
    }
  });

  // GET /heartbeat/history — list of recent runs (limit 50)
  app.get<{
    Querystring: { limit?: string };
  }>('/heartbeat/history', async (req, reply) => {
    try {
      const limit = Math.min(parseInt(req.query.limit ?? '50', 10) || 50, 200);
      const rows = db.prepare(
        'SELECT * FROM heartbeat_runs ORDER BY started_at DESC LIMIT ?'
      ).all(limit) as HeartbeatRunRow[];
      return { data: rows.map(parseRun) };
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: { code: 'INTERNAL', message: String(err) } });
    }
  });

  // POST /heartbeat/run — trigger immediate heartbeat (record a run)
  app.post('/heartbeat/run', async (_req, reply) => {
    try {
      const id = randomUUID();
      const startedAt = new Date().toISOString();

      db.prepare(
        "INSERT INTO heartbeat_runs (id, status, started_at) VALUES (?, 'running', ?)"
      ).run(id, startedAt);

      // Simulate completion immediately (real heartbeat logic would be async)
      const completedAt = new Date().toISOString();
      const result = JSON.stringify({ message: 'Heartbeat triggered manually', timestamp: completedAt });
      db.prepare(
        "UPDATE heartbeat_runs SET status = 'completed', completed_at = ?, result = ? WHERE id = ?"
      ).run(completedAt, result, id);

      // Update last_run_id in config
      db.prepare(
        'UPDATE heartbeat_config SET last_run_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1'
      ).run(id);

      const run = db.prepare('SELECT * FROM heartbeat_runs WHERE id = ?').get(id) as HeartbeatRunRow;
      return reply.status(201).send({ data: parseRun(run) });
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: { code: 'INTERNAL', message: String(err) } });
    }
  });
}
