/**
 * Native Session Runner — handles chat streaming using the native LLM adapter.
 * This replaces sessions-bridge.ts which routed everything through WebSocket.
 */

import { streamChat, type ChatMessage, type ChatOptions } from './chat-engine.js';
import type { ProviderRepository } from '../db/providers.js';
import type { AgentRepository } from '../db/index.js';
import type Database from 'better-sqlite3';
import { resolveProviderBaseUrl, resolveProviderType, providerNeedsApiKey, DEFAULT_TEMPERATURE, DEFAULT_MAX_TOKENS, DEFAULT_SYSTEM_PROMPT } from '../config/defaults.js';

export interface SessionRunnerConfig {
  db: Database.Database;
  agents: AgentRepository;
  providers: ProviderRepository;
}

interface ResolvedAgent {
  id: string;
  name: string;
  emoji: string;
  systemPrompt: string;
  model: string;
  providerType: 'openai' | 'anthropic';
  baseUrl: string;
  apiKey?: string;
  temperature: number;
  maxTokens: number;
}

/**
 * Resolve agent + provider config into streaming-ready options.
 */
export function resolveAgent(
  agentId: string,
  agents: AgentRepository,
  providers: ProviderRepository,
): ResolvedAgent | null {
  const agent = agents.getById(agentId);
  if (!agent) return null;

  // Find provider — try agent's preference, then first available
  const providerList = providers.list();
  const pref = agent.providerPreference || agent.modelPreference?.split('/')[0];
  const provider = providerList.find(p => p.id === pref)
    || providerList.find(p => p.enabled)
    || providerList[0];

  if (!provider) return null;

  // Get unmasked API key
  const unmasked = providers.getUnmasked(provider.id);
  const apiKey = unmasked?.rawApiKey || undefined;

  // Determine provider type and base URL
  const providerType = resolveProviderType(provider.id, provider.type);
  const baseUrl = resolveProviderBaseUrl(provider.id, provider.baseUrl);

  // Determine model — use agent preference, then first provider model, then null (let provider decide)
  const firstModel = provider.models[0];
  const model = agent.modelPreference || (typeof firstModel === 'string' ? firstModel : firstModel?.id) || '';

  return {
    id: agent.id,
    name: agent.name,
    emoji: agent.emoji || '🤖',
    systemPrompt: agent.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    model,
    providerType,
    baseUrl,
    apiKey,
    temperature: agent.temperature ?? DEFAULT_TEMPERATURE,
    maxTokens: agent.maxTokens ?? DEFAULT_MAX_TOKENS,
  };
}

/**
 * Build message history for LLM from DB messages.
 */
export function buildChatMessages(
  systemPrompt: string,
  dbMessages: Array<{ role: string; content: string }>,
  maxHistory = 50,
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  // Include recent history (capped to avoid context overflow)
  const recent = dbMessages.slice(-maxHistory);
  for (const msg of recent) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  return messages;
}

/**
 * Stream a chat response for an agent, yielding SSE-formatted data.
 * This is the main entrypoint that replaces bridge.chat.send().
 */
export async function* runSession(
  resolved: ResolvedAgent,
  messages: ChatMessage[],
): AsyncGenerator<{ type: string; [key: string]: any }> {
  const opts: ChatOptions = {
    model: resolved.model,
    baseUrl: resolved.baseUrl,
    apiKey: resolved.apiKey,
    providerType: resolved.providerType,
    temperature: resolved.temperature,
    maxTokens: resolved.maxTokens,
  };

  yield { type: 'message.start', agentId: resolved.id, agentName: resolved.name, agentEmoji: resolved.emoji };

  let fullContent = '';

  for await (const delta of streamChat(messages, opts)) {
    if (delta.type === 'delta' && delta.content) {
      fullContent += delta.content;
      yield { type: 'message.delta', text: delta.content, agentId: resolved.id };
    }
    if (delta.type === 'error') {
      yield { type: 'error', message: delta.error, agentId: resolved.id };
      return;
    }
    if (delta.type === 'done') {
      yield {
        type: 'message.finish',
        agentId: resolved.id,
        content: fullContent,
        tokensIn: delta.tokensIn ?? 0,
        tokensOut: delta.tokensOut ?? 0,
        model: resolved.model,
      };
    }
  }
}
