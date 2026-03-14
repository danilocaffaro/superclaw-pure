/**
 * message-bus.ts — Central pub/sub EventEmitter for per-session events.
 *
 * Architecture note (HiveClaw Blueprint §5, Sprint A):
 * - In-process EventEmitter (single-instance limitation — see Blueprint §5 for Redis migration path)
 * - Guarded by ENABLE_MESSAGE_BUS feature flag (default OFF until Sprint B frontend is ready)
 * - Used by agent-runner and squad-runner to publish events
 * - Consumed by GET /engine/events/:sessionId SSE endpoint
 *
 * Event flow:
 *   agent-runner/squad-runner → messageBus.publish(sessionId, event)
 *       → SSE endpoint emits to connected EventSource clients
 */

import { EventEmitter } from 'node:events';

// ─── Event Types ─────────────────────────────────────────────────────────────────

export type BusEventType =
  | 'message.start'
  | 'message.delta'
  | 'message.finish'
  | 'typing.start'
  | 'typing.stop'
  | 'tool.start'
  | 'tool.finish'
  | 'error'
  | 'session.end';

export interface BusEvent {
  event: BusEventType;
  sessionId: string;
  data: Record<string, unknown>;
  ts: number; // unix ms
}

export type BusEventMap = {
  'message.start': BusEvent & { data: { agentId: string; agentName: string; agentEmoji?: string } };
  'message.delta': BusEvent & { data: { text: string; agentId?: string; isHeader?: boolean } };
  'message.finish': BusEvent & { data: { tokens_in: number; tokens_out: number; cost?: number } };
  'typing.start': BusEvent & { data: { agentId: string } };
  'typing.stop': BusEvent & { data: { agentId: string } };
  'tool.start': BusEvent & { data: { tool: string; agentId?: string } };
  'tool.finish': BusEvent & { data: { tool: string; result?: unknown; agentId?: string } };
  'error': BusEvent & { data: { message: string; code: string } };
  'session.end': BusEvent & { data: Record<string, never> };
};

// ─── Internal listener type ───────────────────────────────────────────────────────

type BusListener = (event: BusEvent) => void;
type LegacyBusListener = (event: LegacyBusMessage) => void;

// ─── MessageBus ──────────────────────────────────────────────────────────────────

// ─── Legacy API compatibility ─────────────────────────────────────────────────
// agent-worker.ts and workflows.ts use an older publish signature: { id, from, to, type, content, metadata }
// This adapter makes MessageBus compatible with both APIs.

export interface LegacyBusMessage {
  id?: string;
  from: string;
  to: string;
  type: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/** @deprecated Use LegacyBusMessage — kept for backward compat */
export type AgentMessage = LegacyBusMessage;

export class MessageBus {
  private readonly emitter = new EventEmitter();
  /** Track listener count per session for leak detection */
  private readonly listenerCounts = new Map<string, number>();

  constructor() {
    // Prevent Node.js default MaxListenersExceededWarning.
    // Each session can have up to 50 concurrent SSE subscribers.
    this.emitter.setMaxListeners(500);
  }

  /**
   * Publish an event to all subscribers of a session (new API).
   */
  publish<T extends BusEventType>(
    sessionIdOrLegacy: string | LegacyBusMessage,
    event?: T,
    data?: BusEventMap[T]['data'],
  ): void {
    // Legacy API: agent-worker/workflow-engine passes { from, to, type, content, metadata }
    if (typeof sessionIdOrLegacy === 'object') {
      const msg = sessionIdOrLegacy;
      // Emit to the 'to' topic so workflow subscribers receive it
      this.emitter.emit(`session:${msg.to}`, msg);
      return;
    }

    const sessionId = sessionIdOrLegacy;
    if (!event || !data) return;

    const payload: BusEvent = {
      event,
      sessionId,
      data: data as Record<string, unknown>,
      ts: Date.now(),
    };
    this.emitter.emit(`session:${sessionId}`, payload);
  }

  /**
   * Subscribe to events.
   *
   * New API: subscribe(sessionId, listener: BusListener) → unsubscribe fn
   * Legacy API: subscribe(topic, listener: (msg: LegacyBusMessage) => void) → unsubscribe fn
   *   (Used by workflow-engine.ts and workflows.ts)
   */
  subscribe(sessionId: string, listener: BusListener | LegacyBusListener): () => void {
    const key = `session:${sessionId}`;
    this.emitter.on(key, listener);

    // Track listener count for diagnostics
    const count = (this.listenerCounts.get(sessionId) ?? 0) + 1;
    this.listenerCounts.set(sessionId, count);

    // Return cleanup function
    return () => {
      this.emitter.off(key, listener);
      const remaining = (this.listenerCounts.get(sessionId) ?? 1) - 1;
      if (remaining <= 0) {
        this.listenerCounts.delete(sessionId);
      } else {
        this.listenerCounts.set(sessionId, remaining);
      }
    };
  }

  /**
   * Returns active subscriber count for a session.
   * Useful for diagnostics and tests.
   */
  subscriberCount(sessionId: string): number {
    return this.listenerCounts.get(sessionId) ?? 0;
  }

  /**
   * Remove all listeners for a session (e.g. on session delete).
   */
  purge(sessionId: string): void {
    this.emitter.removeAllListeners(`session:${sessionId}`);
    this.listenerCounts.delete(sessionId);
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────────

export const messageBus = new MessageBus();

/** Convenience accessor for modules that prefer a getter pattern */
export function getMessageBus(): MessageBus {
  return messageBus;
}
