// ============================================================
// Browser API — Session management + Playwright automation
// Routes:
//   POST /browser/screenshot              — quick screenshot (Playwright or thum.io)
//   GET  /browser/status                  — engine status
//   POST /browser/sessions                — create new browser session
//   GET  /browser/sessions                — list active sessions
//   POST /browser/sessions/:id/navigate   — navigate session to URL
//   POST /browser/sessions/:id/click      — click element in session
//   POST /browser/sessions/:id/type       — type text in session
//   GET  /browser/sessions/:id/screenshot — capture screenshot
//   POST /browser/sessions/:id/evaluate   — evaluate JS expression
//   DELETE /browser/sessions/:id          — close session
// ============================================================

import { FastifyInstance } from 'fastify';
import { getBrowserPool } from '../engine/browser-pool.js';

export function registerBrowserRoutes(app: FastifyInstance) {
  // ── POST /browser/screenshot — quick one-off screenshot ────────────────────
  app.post<{ Body: { url: string } }>('/browser/screenshot', async (req, reply) => {
    const { url } = req.body ?? {};
    if (!url) {
      return reply.status(400).send({ error: { code: 'VALIDATION', message: 'url required' } });
    }

    const pool = getBrowserPool();
    const status = await pool.getStatusAsync();

    // If Playwright available, take a real screenshot
    if (status.engine === 'playwright') {
      try {
        const session = await pool.createSession(url);
        const content = await pool.navigate(session.id, url);
        const shot = await pool.screenshot(session.id);
        await pool.closeSession(session.id);

        return reply.send({
          data: {
            url: content.url,
            title: content.title,
            screenshotBase64: shot?.base64,
            mimeType: shot?.mimeType ?? 'image/jpeg',
            timestamp: new Date().toISOString(),
            viewport: { width: 1280, height: 800 },
            engine: 'playwright',
          },
        });
      } catch (err) {
        // Fall through to thum.io
      }
    }

    // Fallback: thum.io proxy
    const encoded = encodeURIComponent(url);
    return reply.send({
      data: {
        url,
        imageUrl: `https://image.thum.io/get/width/1280/crop/800/${encoded}`,
        timestamp: new Date().toISOString(),
        viewport: { width: 1280, height: 800 },
        engine: 'thum.io',
      },
    });
  });

  // ── GET /browser/status ─────────────────────────────────────────────────────
  app.get('/browser/status', async (_req, reply) => {
    const pool = getBrowserPool();
    const status = await pool.getStatusAsync();
    return reply.send({
      data: {
        available: true,
        engine: status.engine === 'playwright' ? 'playwright' : 'fetch + thum.io (screenshot proxy)',
        activeSessions: status.activeSessions,
        maxSessions: status.maxSessions,
        note:
          status.engine === 'fetch'
            ? 'Install playwright for full browser control: npm install playwright'
            : 'Playwright engine active — full browser automation available',
      },
    });
  });

  // ── POST /browser/sessions — create a new browser session ──────────────────
  app.post<{ Body: { url?: string } }>('/browser/sessions', async (req, reply) => {
    const pool = getBrowserPool();
    const { url } = req.body ?? {};
    const session = await pool.createSession(url);
    return reply.status(201).send({ data: session });
  });

  // ── GET /browser/sessions — list active sessions ────────────────────────────
  app.get('/browser/sessions', async (_req, reply) => {
    const pool = getBrowserPool();
    const sessions = pool.listSessions();
    return reply.send({
      data: {
        status: pool.getStatus(),
        sessions,
      },
    });
  });

  // ── POST /browser/sessions/:id/navigate ─────────────────────────────────────
  app.post<{
    Params: { id: string };
    Body: { url: string };
  }>('/browser/sessions/:id/navigate', async (req, reply) => {
    const pool = getBrowserPool();
    const { id } = req.params;
    const { url } = req.body ?? {};

    if (!url) {
      return reply.status(400).send({ error: { code: 'VALIDATION', message: 'url required' } });
    }

    try {
      const content = await pool.navigate(id, url);
      return reply.send({
        data: {
          sessionId: id,
          url: content.url,
          title: content.title,
          textPreview: content.text.slice(0, 2000),
          linkCount: content.links.length,
          links: content.links.slice(0, 20),
          screenshotBase64: content.screenshotBase64,
          screenshotUrl: content.screenshotUrl,
        },
      });
    } catch (err) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: (err as Error).message },
      });
    }
  });

  // ── POST /browser/sessions/:id/click ────────────────────────────────────────
  app.post<{
    Params: { id: string };
    Body: { selector: string };
  }>('/browser/sessions/:id/click', async (req, reply) => {
    const pool = getBrowserPool();
    const { id } = req.params;
    const { selector } = req.body ?? {};

    if (!selector) {
      return reply.status(400).send({
        error: { code: 'VALIDATION', message: 'selector required' },
      });
    }

    try {
      const result = await pool.click(id, selector);
      return reply.send({
        data: {
          sessionId: id,
          url: result.url,
          title: result.title,
          textPreview: result.text.slice(0, 2000),
        },
      });
    } catch (err) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: (err as Error).message },
      });
    }
  });

  // ── POST /browser/sessions/:id/type ─────────────────────────────────────────
  app.post<{
    Params: { id: string };
    Body: { selector: string; text: string };
  }>('/browser/sessions/:id/type', async (req, reply) => {
    const pool = getBrowserPool();
    const { id } = req.params;
    const { selector, text } = req.body ?? {};

    if (!selector || !text) {
      return reply.status(400).send({
        error: { code: 'VALIDATION', message: 'selector and text required' },
      });
    }

    try {
      const result = await pool.type(id, selector, text);
      return reply.send({
        data: {
          sessionId: id,
          url: result.url,
          title: result.title,
          textPreview: result.text.slice(0, 2000),
        },
      });
    } catch (err) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: (err as Error).message },
      });
    }
  });

  // ── GET /browser/sessions/:id/screenshot ────────────────────────────────────
  app.get<{ Params: { id: string } }>('/browser/sessions/:id/screenshot', async (req, reply) => {
    const pool = getBrowserPool();
    const { id } = req.params;

    try {
      const shot = await pool.screenshot(id);
      if (!shot) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'No Playwright page — screenshot unavailable' },
        });
      }
      return reply.send({
        data: {
          sessionId: id,
          base64: shot.base64,
          mimeType: shot.mimeType,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      return reply.status(500).send({
        error: { code: 'SCREENSHOT_FAILED', message: (err as Error).message },
      });
    }
  });

  // ── POST /browser/sessions/:id/evaluate — run JS in page ───────────────────
  app.post<{
    Params: { id: string };
    Body: { expression: string };
  }>('/browser/sessions/:id/evaluate', async (req, reply) => {
    const pool = getBrowserPool();
    const { id } = req.params;
    const { expression } = req.body ?? {};

    if (!expression) {
      return reply.status(400).send({
        error: { code: 'VALIDATION', message: 'expression required' },
      });
    }

    try {
      const result = await pool.evaluate(id, expression);
      return reply.send({
        data: {
          sessionId: id,
          result,
        },
      });
    } catch (err) {
      return reply.status(404).send({
        error: { code: 'EVAL_FAILED', message: (err as Error).message },
      });
    }
  });

  // ── DELETE /browser/sessions/:id ────────────────────────────────────────────
  app.delete<{ Params: { id: string } }>('/browser/sessions/:id', async (req, reply) => {
    const pool = getBrowserPool();
    const { id } = req.params;
    await pool.closeSession(id);
    return reply.status(204).send();
  });
}
