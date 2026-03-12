// ============================================================
// Console API — SSE log tail for agent/server output
// Routes:
//   GET  /api/console/stream — SSE stream of log lines
//   GET  /api/console/history — last N lines
//   POST /api/console/clear  — clear log buffer
// ============================================================

import { FastifyInstance } from 'fastify';

// In-memory circular log buffer
const MAX_LOG_LINES = 2000;
const logBuffer: LogLine[] = [];
const sseClients = new Set<(data: string) => void>();

interface LogLine {
  id: number;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string;
}

let lineCounter = 0;

// Intercept stdout/stderr to capture log output
function setupLogCapture() {
  const origStdoutWrite = process.stdout.write.bind(process.stdout) as typeof process.stdout.write;
  const origStderrWrite = process.stderr.write.bind(process.stderr) as typeof process.stderr.write;

  function parseLine(raw: string, defaultLevel: 'info' | 'error'): void {
    const text = raw.replace(/\n$/, '');
    if (!text.trim()) return;

    // Detect level from content
    let level: LogLine['level'] = defaultLevel;
    const lower = text.toLowerCase();
    if (lower.includes('error') || lower.includes('err')) level = 'error';
    else if (lower.includes('warn')) level = 'warn';
    else if (lower.includes('debug')) level = 'debug';

    const line: LogLine = {
      id: ++lineCounter,
      timestamp: new Date().toISOString(),
      level,
      message: text,
    };

    logBuffer.push(line);
    if (logBuffer.length > MAX_LOG_LINES) logBuffer.shift();

    // Broadcast to SSE clients
    const data = JSON.stringify(line);
    for (const send of sseClients) {
      send(data);
    }
  }

  // Use a simpler override pattern that satisfies TS overloads
  const origOut = origStdoutWrite;
  const origErr = origStderrWrite;

  process.stdout.write = function(chunk: unknown, ...rest: unknown[]): boolean {
    const str = typeof chunk === 'string' ? chunk : Buffer.from(chunk as Uint8Array).toString();
    parseLine(str, 'info');
    return origOut.call(process.stdout, chunk as string, ...rest as []) as boolean;
  } as typeof process.stdout.write;

  process.stderr.write = function(chunk: unknown, ...rest: unknown[]): boolean {
    const str = typeof chunk === 'string' ? chunk : Buffer.from(chunk as Uint8Array).toString();
    parseLine(str, 'error');
    return origErr.call(process.stderr, chunk as string, ...rest as []) as boolean;
  } as typeof process.stderr.write;
}

let captureInitialized = false;

export function registerConsoleRoutes(app: FastifyInstance) {
  // Set up log capture once
  if (!captureInitialized) {
    setupLogCapture();
    captureInitialized = true;
  }

  // ── GET /api/console/stream — SSE log stream ──────────────────────────────
  app.get('/api/console/stream', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });

    // Send recent history first (last 50 lines)
    const recent = logBuffer.slice(-50);
    for (const line of recent) {
      reply.raw.write(`event: log\ndata: ${JSON.stringify(line)}\n\n`);
    }

    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ bufferedLines: logBuffer.length })}\n\n`);

    const send = (data: string) => {
      reply.raw.write(`event: log\ndata: ${data}\n\n`);
    };

    sseClients.add(send);

    // Keepalive every 30s
    const keepalive = setInterval(() => {
      reply.raw.write(`:keepalive\n\n`);
    }, 30_000);

    req.raw.on('close', () => {
      sseClients.delete(send);
      clearInterval(keepalive);
    });

    return reply;
  });

  // ── GET /api/console/history — fetch recent log lines ─────────────────────
  app.get<{ Querystring: { limit?: string; level?: string } }>('/api/console/history', async (req, reply) => {
    const limit = Math.min(parseInt(req.query.limit ?? '100', 10) || 100, MAX_LOG_LINES);
    const level = req.query.level as LogLine['level'] | undefined;

    let lines = logBuffer.slice(-limit);
    if (level) {
      lines = lines.filter(l => l.level === level);
    }

    return reply.send({ data: { lines, total: logBuffer.length } });
  });

  // ── POST /api/console/clear — clear buffer ───────────────────────────────
  app.post('/api/console/clear', async (_req, reply) => {
    logBuffer.length = 0;
    lineCounter = 0;
    return reply.send({ data: { status: 'cleared' } });
  });
}
