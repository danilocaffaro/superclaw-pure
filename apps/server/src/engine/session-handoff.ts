// ============================================================
// Session Handoff — Transfer a session between agents
// ============================================================

import { getSessionManager } from './session-manager.js';
import { getWorkerPool } from './agent-worker-pool.js';
import { getMessageBus } from './message-bus.js';

// ─── Public Interfaces ────────────────────────────────────────────────────────

export interface HandoffRequest {
  sessionId: string;
  fromAgentId: string;
  toAgentId: string;
  reason?: string;
  contextSummary?: string;
}

export interface HandoffResult {
  success: boolean;
  sessionId: string;
  fromAgentId: string;
  toAgentId: string;
  message?: string;
}

// ─── Handoff Logic ────────────────────────────────────────────────────────────

export function handoffSession(req: HandoffRequest): HandoffResult {
  const sm = getSessionManager();
  const pool = getWorkerPool();
  const bus = getMessageBus();

  // 1. Validate session exists
  const session = sm.getSession(req.sessionId);
  if (!session) {
    return { success: false, sessionId: req.sessionId, fromAgentId: req.fromAgentId, toAgentId: req.toAgentId, message: 'Session not found' };
  }

  // 2. Validate both agents exist in pool
  const fromWorker = pool.get(req.fromAgentId);
  const toWorker = pool.get(req.toAgentId);

  if (!fromWorker) {
    return { success: false, sessionId: req.sessionId, fromAgentId: req.fromAgentId, toAgentId: req.toAgentId, message: `Source agent ${req.fromAgentId} not found in pool` };
  }
  if (!toWorker) {
    return { success: false, sessionId: req.sessionId, fromAgentId: req.fromAgentId, toAgentId: req.toAgentId, message: `Target agent ${req.toAgentId} not found in pool` };
  }

  const fromName = fromWorker.config.name;
  const toName = toWorker.config.name;

  // 3. Update session's agent_id in DB
  sm.updateSession(req.sessionId, { agent_id: req.toAgentId });

  // 4. Add a system message documenting the handoff
  const handoffNote = req.contextSummary
    ? `[Handoff from ${fromName} to ${toName}]: ${req.reason ?? 'Agent transfer'}. Context: ${req.contextSummary}`
    : `[Handoff from ${fromName} to ${toName}]: ${req.reason ?? 'Agent transfer'}`;

  sm.addMessage(req.sessionId, {
    role: 'system',
    content: handoffNote,
  });

  // 5. Notify via message bus
  bus.publish({
    from: req.fromAgentId,
    to: req.toAgentId,
    type: 'request',
    content: JSON.stringify({
      topic: 'session.handoff',
      sessionId: req.sessionId,
      reason: req.reason,
      contextSummary: req.contextSummary,
    }),
    metadata: {
      sessionId: req.sessionId,
      priority: 2,
      timestamp: Date.now(),
    },
  });

  return {
    success: true,
    sessionId: req.sessionId,
    fromAgentId: req.fromAgentId,
    toAgentId: req.toAgentId,
    message: `Session handed off to ${toName}`,
  };
}
