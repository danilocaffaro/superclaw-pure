import { logger } from '../lib/logger.js';
// ============================================================
// Preview API — SSE file watcher for hot-reload
// Routes:
//   GET  /api/preview/events — SSE stream of file-change events
//   POST /api/preview/watch  — set watch directory
// ============================================================

import { FastifyInstance } from 'fastify';
import { watch, type FSWatcher } from 'fs';
import { resolve } from 'path';
import { existsSync, statSync } from 'fs';

// Global watch state
let currentWatcher: FSWatcher | null = null;
let watchDir: string = process.cwd();
const sseClients = new Set<(data: string) => void>();

// Debounce file change events (many editors write multiple times)
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 300;

function startWatching(dir: string) {
  // Clean up old watcher
  if (currentWatcher) {
    currentWatcher.close();
    currentWatcher = null;
  }

  const absDir = resolve(dir);
  if (!existsSync(absDir) || !statSync(absDir).isDirectory()) {
    logger.warn(`[preview] Cannot watch: ${absDir} (not a directory)`);
    return;
  }

  watchDir = absDir;

  try {
    currentWatcher = watch(absDir, { recursive: true }, (_eventType, filename) => {
      if (!filename) return;

      // Ignore common noise: node_modules, .git, dist, build, .next
      const ignored = /node_modules|\.git|dist\/|build\/|\.next|\.swp$|\.swo$|~$/;
      if (ignored.test(filename)) return;

      // Debounce
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const event = JSON.stringify({ file: filename, timestamp: Date.now() });
        for (const send of sseClients) {
          send(event);
        }
      }, DEBOUNCE_MS);
    });

    logger.info(`[preview] Watching: ${absDir}`);
  } catch (err) {
    logger.error({ err }, `[preview] Watch failed`);
  }
}

export function registerPreviewRoutes(app: FastifyInstance) {
  // ── GET /api/preview/events — SSE file change stream ──────────────────────
  app.get('/api/preview/events', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });

    // Send connected event
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ watchDir })}\n\n`);

    const send = (data: string) => {
      reply.raw.write(`event: file-change\ndata: ${data}\n\n`);
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

    // Start watching if not already
    if (!currentWatcher) {
      startWatching(watchDir);
    }

    // Don't let Fastify close the reply
    return reply;
  });

  // ── POST /api/preview/watch — set watch directory ─────────────────────────
  app.post<{ Body: { dir: string } }>('/api/preview/watch', async (req, reply) => {
    const { dir } = req.body ?? {};
    if (!dir) {
      return reply.status(400).send({ error: { code: 'VALIDATION', message: 'dir required' } });
    }

    const absDir = resolve(dir);
    if (!existsSync(absDir) || !statSync(absDir).isDirectory()) {
      return reply.status(400).send({
        error: { code: 'NOT_FOUND', message: `Not a directory: ${absDir}` },
      });
    }

    startWatching(absDir);
    return reply.send({ data: { watchDir: absDir, status: 'watching' } });
  });
}
