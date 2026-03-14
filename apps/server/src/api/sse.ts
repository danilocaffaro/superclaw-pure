// ============================================================
// SSE Routes — Event broadcast (native engine events)
// ============================================================

import type { FastifyInstance } from 'fastify';
import { EventEmitter } from 'node:events';
import { messageBus } from '../engine/message-bus.js';

// Global event bus for SSE broadcast
export const sseBus = new EventEmitter();
sseBus.setMaxListeners(100);

// Track active SSE connections
const sseClients = new Map<string, Set<(data: string) => void>>();

/**
 * Broadcast an event to all SSE subscribers.
 * Call this from session runners, squad runners, etc.
 */
export function broadcastSSE(sessionKey: string | null, event: string, payload: unknown) {
  const data = JSON.stringify({ event, payload });

  // Broadcast to session-specific listeners
  if (sessionKey && sseClients.has(sessionKey)) {
    for (const send of sseClients.get(sessionKey)!) {
      send(data);
    }
  }

  // Always broadcast to wildcard "*"
  if (sseClients.has('*')) {
    for (const send of sseClients.get('*')!) {
      send(data);
    }
  }
}

export function registerSSERoutes(app: FastifyInstance) {
  // Listen for engine events and broadcast
  sseBus.on('event', (eventName: string, sessionKey: string | null, payload: unknown) => {
    broadcastSSE(sessionKey, eventName, payload);
  });

  // ── GET /engine/events/:sessionId — per-session MessageBus SSE stream ───
  // Sprint A: endpoint exists but MessageBus only populates when ENABLE_MESSAGE_BUS=true
  // Sprint B: frontend EventSource will connect here
  app.get<{ Params: { sessionId: string } }>('/engine/events/:sessionId', async (req, reply) => {
    const { sessionId } = req.params;

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
      // Auto-reconnect: browser EventSource retries after 3s on disconnect
      // Backoff handled client-side: 1s → 2s → 4s → max 30s (Blueprint §5, Sprint B)
    });

    // Send retry hint to browser EventSource
    reply.raw.write(`retry: 3000\n\n`);
    reply.raw.write(`data: ${JSON.stringify({ event: 'connected', sessionId })}\n\n`);

    // Subscribe to MessageBus for this session
    const unsubscribe = messageBus.subscribe(sessionId, (busEvent: unknown) => {
      const ssePayload = `data: ${JSON.stringify(busEvent)}\n\n`;
      reply.raw.write(ssePayload);
    });

    // Heartbeat to keep connection alive through proxies/load balancers
    const heartbeat = setInterval(() => {
      reply.raw.write(`:heartbeat\n\n`);
    }, 15_000);

    // Cleanup on disconnect — CRITICAL: prevents EventEmitter memory leak
    req.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe(); // removes listener from MessageBus
    });
    req.raw.on('error', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });

    await new Promise<void>((resolve) => {
      req.raw.on('close', resolve);
      req.raw.on('error', resolve);
    });
  });

  // ── GET /events — wildcard event stream ───────────────────────────────
  app.get('/events', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });

    reply.raw.write(`data: ${JSON.stringify({ event: 'connected', payload: {} })}\n\n`);

    const send = (data: string) => {
      reply.raw.write(`data: ${data}\n\n`);
    };

    if (!sseClients.has('*')) sseClients.set('*', new Set());
    sseClients.get('*')!.add(send);

    const heartbeat = setInterval(() => {
      reply.raw.write(`:heartbeat\n\n`);
    }, 15_000);

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      sseClients.get('*')?.delete(send);
      if (sseClients.get('*')?.size === 0) sseClients.delete('*');
    });

    await new Promise<void>((resolve) => {
      req.raw.on('close', resolve);
      req.raw.on('error', resolve);
    });
  });
}
