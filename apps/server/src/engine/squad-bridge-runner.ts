// ============================================================
// Squad Runner v2 — Native Engine (SuperClaw Pure)
// ============================================================
//
// Emulates a TC2 group channel: each agent gets its own session
// with full conversation context, group metadata, and ARCHER v2 rules.
// 
// This version routes through the native chat engine instead of
// the OpenClaw Bridge WebSocket. ARCHER v2 + NEXUS v3 remain intact.

import type { FastifyReply } from 'fastify';
import { parseMentions, detectPullThrough, detectTags, buildArcherContext } from './archer-router.js';
import type { MentionParseResult } from './archer-router.js';
import { detectIntent } from './nexus-templates.js';
import { resolveAgent, buildChatMessages, runSession } from './native-session-runner.js';
import { logger } from '../lib/logger.js';
import { initDatabase, AgentRepository, MessageRepository } from '../db/index.js';
import { ProviderRepository } from '../db/providers.js';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SSEEvent {
  event: string;
  data: Record<string, unknown>;
}

export interface SquadAgent {
  id: string;
  name: string;
  emoji: string;
  sessionKey: string;
}

export interface SquadBridgeConfig {
  squadId: string;
  squadName: string;
  agents: SquadAgent[];
  strategy: 'sequential' | 'parallel';
  sessionId: string;
  senderName?: string;
}

interface AgentResponse {
  agentId: string;
  agentName: string;
  agentEmoji: string;
  text: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function serializeSSE(event: SSEEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

function cleanName(id: string, rawName: string): string {
  if (!rawName || rawName === id) return id.charAt(0).toUpperCase() + id.slice(1);
  return rawName;
}

// In-memory conversation history per squad session
const squadHistory = new Map<string, Array<{ role: string; content: string }>>();

function getSquadHistory(key: string): Array<{ role: string; content: string }> {
  if (!squadHistory.has(key)) squadHistory.set(key, []);
  return squadHistory.get(key)!;
}

function buildMessageWithHistory(
  userMessage: string,
  senderName: string,
  previousResponses: AgentResponse[],
  groupContext: string,
): string {
  let fullMessage = '';

  if (previousResponses.length > 0) {
    fullMessage += '--- Conversation so far ---\n\n';
    fullMessage += `**${senderName}:** ${userMessage}\n\n`;
    for (const resp of previousResponses) {
      if (resp.text && !resp.text.includes('is busy')) {
        fullMessage += `**${resp.agentEmoji} ${resp.agentName}:** ${resp.text}\n\n`;
      }
    }
    fullMessage += '--- End of conversation ---\n\nNow it\'s your turn. Respond to the conversation above.\n\n';
  } else {
    fullMessage += `**${senderName}:** ${userMessage}\n\n`;
  }

  fullMessage += `\n${groupContext}`;
  return fullMessage;
}

/**
 * Send a message to one agent via native engine and collect the full response.
 */
async function sendToAgent(
  agent: SquadAgent,
  message: string,
  emit: (event: SSEEvent) => void,
  config: SquadBridgeConfig,
): Promise<string> {
  const db = initDatabase();
  const agents = new AgentRepository(db);
  const providers = new ProviderRepository(db);

  const resolved = resolveAgent(agent.id, agents, providers);
  if (!resolved) {
    const errMsg = `❌ Agent ${agent.name} not configured`;
    emit({ event: 'message.delta', data: { text: errMsg, agentId: agent.id } });
    return errMsg;
  }

  // Build squad-aware system prompt
  const memberList = config.agents.map(a => `${a.emoji} ${a.name} (${a.id})`).join(', ');
  const squadPrompt = `${resolved.systemPrompt}\n\n[Squad Session: "${config.squadName}"]\nMembers: ${memberList}\nAPPLY: ARCHER v2 (ROLE-GATE, ECHO-FREE), respond as yourself.`;

  // Get squad conversation history
  const historyKey = `squad:${config.squadId}:${agent.id}`;
  const history = getSquadHistory(historyKey);
  history.push({ role: 'user', content: message });

  const messages = buildChatMessages(squadPrompt, history);

  let fullText = '';

  try {
    for await (const event of runSession(resolved, messages)) {
      if (event.type === 'message.delta' && event.text) {
        fullText += event.text;
        emit({
          event: 'message.delta',
          data: { text: event.text, agentId: agent.id, agentName: agent.name, agentEmoji: agent.emoji },
        });
      }
      if (event.type === 'error') {
        emit({
          event: 'message.delta',
          data: { text: `\n⚠️ ${agent.name}: ${event.message}\n`, agentId: agent.id },
        });
      }
    }
  } catch (err: any) {
    const errMsg = `\n❌ ${agent.name}: ${err.message}\n`;
    emit({ event: 'message.delta', data: { text: errMsg, agentId: agent.id } });
    return errMsg;
  }

  // Save to history
  if (fullText) {
    history.push({ role: 'assistant', content: fullText });
  }

  return fullText;
}

// ─── Message Persistence ────────────────────────────────────────────────────

function persistMessages(sessionId: string, userMessage: string, agentResponses: AgentResponse[]): void {
  try {
    const db = initDatabase();
    const repo = new MessageRepository(db);

    repo.insert({
      session_id: sessionId,
      role: 'user',
      content: JSON.stringify([{ type: 'text', text: userMessage }]),
    });

    for (const resp of agentResponses) {
      if (!resp.text) continue;
      repo.insert({
        session_id: sessionId,
        role: 'assistant',
        agent_id: resp.agentId,
        content: JSON.stringify([{ type: 'text', text: resp.text }]),
      });
    }
  } catch (err) {
    logger.warn(`[SquadRunner] Failed to persist messages: ${(err as Error).message}`);
  }
}

// ─── Main Entry Point ──────────────────────────────────────────────────────

export async function runSquadViaBridge(
  _bridge: unknown, // kept for signature compat — unused in Pure
  reply: FastifyReply,
  config: SquadBridgeConfig,
  message: string,
): Promise<void> {
  for (const agent of config.agents) {
    agent.name = cleanName(agent.id, agent.name);
  }

  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  const emit = (event: SSEEvent) => {
    reply.raw.write(serializeSSE(event));
  };

  emit({
    event: 'message.start',
    data: { sessionId: config.sessionId, squadId: config.squadId, mode: config.strategy },
  });

  if (config.agents.length === 0) {
    emit({ event: 'error', data: { message: 'Squad has no agents', code: 'NO_AGENTS' } });
    reply.raw.end();
    return;
  }

  // NEXUS v3: Detect intent
  const intentResult = detectIntent(message);
  if (intentResult.template) {
    emit({
      event: 'squad.nexus',
      data: { intent: intentResult.intent, phase: intentResult.phase, confidence: intentResult.confidence },
    });
    message = `${message}\n\n${intentResult.template}`;
    logger.info(`[NEXUS] Detected intent=${intentResult.intent} phase=${intentResult.phase}`);
  }

  let agentResponses: AgentResponse[] = [];

  try {
    if (config.strategy === 'sequential') {
      agentResponses = await runSequential(config, message, emit);
    } else {
      agentResponses = await runParallel(config, message, emit);
    }
  } catch (err) {
    emit({ event: 'error', data: { message: (err as Error).message, code: 'SQUAD_ERROR' } });
  }

  persistMessages(config.sessionId, message, agentResponses);
  emit({ event: 'message.finish', data: { sessionId: config.sessionId, squadId: config.squadId } });
  reply.raw.end();
}

// ─── Sequential Strategy ─────────────────────────────────────────────────────

async function runSequential(
  config: SquadBridgeConfig,
  message: string,
  emit: (event: SSEEvent) => void,
): Promise<AgentResponse[]> {
  const responses: AgentResponse[] = [];

  const mentionResult = parseMentions(message, config.agents);
  let targetAgents = mentionResult.targetAgents;
  const totalTurns = targetAgents.length;

  emit({
    event: 'squad.routing',
    data: {
      mode: mentionResult.isAllMention ? 'all' : mentionResult.isNoMention ? 'po-only' : 'mentioned',
      targets: targetAgents.map(a => ({ id: a.id, name: a.name, emoji: a.emoji })),
    },
  });

  for (let i = 0; i < targetAgents.length; i++) {
    const agent = targetAgents[i];
    const turn = i + 1;

    emit({
      event: 'message.delta',
      data: { text: `\n\n**${agent.emoji} ${agent.name}** _(${turn}/${totalTurns})_\n\n`, agentId: agent.id, isHeader: true },
    });

    const groupContext = buildArcherContext(config, agent, turn, totalTurns, mentionResult);
    const fullMessage = buildMessageWithHistory(
      mentionResult.cleanMessage,
      config.senderName ?? 'You',
      responses.filter(r => r.text && !r.text.includes('is busy')),
      groupContext,
    );

    const response = await sendToAgent(agent, fullMessage, emit, config);

    if (!response) {
      responses.push({ agentId: agent.id, agentName: agent.name, agentEmoji: agent.emoji, text: `_${agent.name} did not respond_` });
    } else {
      responses.push({ agentId: agent.id, agentName: agent.name, agentEmoji: agent.emoji, text: response });

      // PO Pull-Through
      if (i === 0 && mentionResult.isNoMention) {
        const pullResult = detectPullThrough(response, config.agents, agent);
        if (pullResult.pulledAgents.length > 0) {
          const alreadyTargeted = new Set(targetAgents.map(a => a.id));
          const newAgents = pullResult.pulledAgents.filter(a => !alreadyTargeted.has(a.id));
          targetAgents = [...targetAgents, ...newAgents];
          mentionResult.isNoMention = false;
          emit({ event: 'squad.pull-through', data: { pulledBy: agent.id, pulledAgents: newAgents.map(a => ({ id: a.id, name: a.name, emoji: a.emoji })) } });
        }
      }

      // NEXUS v3 tags
      const tags = detectTags(response);
      if (tags.length > 0) {
        emit({ event: 'squad.tags', data: { agentId: agent.id, tags } });
      }
    }
  }

  return responses;
}

// ─── Parallel Strategy ───────────────────────────────────────────────────────

async function runParallel(
  config: SquadBridgeConfig,
  message: string,
  emit: (event: SSEEvent) => void,
): Promise<AgentResponse[]> {
  const mentionResult = parseMentions(message, config.agents);
  const targetAgents = mentionResult.targetAgents;

  emit({
    event: 'squad.routing',
    data: {
      mode: mentionResult.isAllMention ? 'all' : mentionResult.isNoMention ? 'po-only' : 'mentioned',
      targets: targetAgents.map(a => ({ id: a.id, name: a.name, emoji: a.emoji })),
    },
  });

  for (const agent of targetAgents) {
    emit({ event: 'message.delta', data: { text: `\n\n**${agent.emoji} ${agent.name}**\n\n`, agentId: agent.id, isHeader: true } });
  }

  const results = await Promise.all(
    targetAgents.map(agent => {
      const groupContext = buildArcherContext(config, agent, 1, targetAgents.length, mentionResult);
      const fullMessage = buildMessageWithHistory(mentionResult.cleanMessage, config.senderName ?? 'You', [], groupContext);
      return sendToAgent(agent, fullMessage, emit, config);
    }),
  );

  return targetAgents.map((agent, i) => ({
    agentId: agent.id,
    agentName: agent.name,
    agentEmoji: agent.emoji,
    text: results[i] || `_${agent.name} did not respond_`,
  }));
}
