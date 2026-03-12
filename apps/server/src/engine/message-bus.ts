// ============================================================
// Message Bus — Central pub/sub router for agent-to-agent communication
// ============================================================

import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';

// ─── Message Types ────────────────────────────────────────────────────────────

export interface AgentMessage {
  id: string;
  from: string;           // agentId, 'system', or 'user'
  to: string;             // agentId or topic like 'squad.{id}'
  type: 'request' | 'response' | 'broadcast' | 'delegate' | 'consensus' | 'status';
  content: string;
  metadata: {
    sessionId: string;
    squadId?: string;
    replyTo?: string;
    priority: number;
    timestamp: number;
  };
}

// ─── History Filter Options ───────────────────────────────────────────────────

export interface HistoryFilterOptions {
  agentId?: string;
  sessionId?: string;
  limit?: number;
}

// ─── Message Bus ──────────────────────────────────────────────────────────────

export class MessageBus {
  private emitter = new EventEmitter();
  private history: AgentMessage[] = [];
  private maxHistory = 1000;

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  /**
   * Publish a message to the bus.
   * Emits to:
   *   1. `agent.{to}.inbox` — direct delivery to target agent
   *   2. `{to}` — topic-based delivery (e.g. squad broadcasts)
   *   3. `message` — global event for monitoring / debugging
   */
  publish(msg: Omit<AgentMessage, 'id'>): AgentMessage {
    const full: AgentMessage = { ...msg, id: uuid() };
    this.history.push(full);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Emit to specific target
    this.emitter.emit(`agent.${msg.to}.inbox`, full);
    // Emit to topic (for squad broadcasts)
    this.emitter.emit(msg.to, full);
    // Global event for monitoring
    this.emitter.emit('message', full);

    return full;
  }

  /**
   * Subscribe to a topic or agent inbox.
   * Returns an unsubscribe function.
   */
  subscribe(topic: string, handler: (msg: AgentMessage) => void): () => void {
    this.emitter.on(topic, handler);
    return () => {
      this.emitter.off(topic, handler);
    };
  }

  /**
   * Retrieve message history, optionally filtered by agent, session, or limited.
   */
  getHistory(opts?: HistoryFilterOptions): AgentMessage[] {
    let msgs = this.history;
    if (opts?.agentId) {
      msgs = msgs.filter(m => m.from === opts.agentId || m.to === opts.agentId);
    }
    if (opts?.sessionId) {
      msgs = msgs.filter(m => m.metadata.sessionId === opts.sessionId);
    }
    return opts?.limit ? msgs.slice(-opts.limit) : msgs;
  }

  /**
   * Clear all message history.
   */
  clear(): void {
    this.history = [];
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _bus: MessageBus | null = null;

export function getMessageBus(): MessageBus {
  if (!_bus) _bus = new MessageBus();
  return _bus;
}
