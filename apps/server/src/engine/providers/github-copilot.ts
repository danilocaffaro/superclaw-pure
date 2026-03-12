/**
 * GitHub Copilot Provider
 *
 * Uses the OpenAI SDK against https://api.githubcopilot.com with a Copilot session token.
 * Token is obtained from the gh CLI OAuth flow and cached locally.
 * The API is OpenAI-compatible but requires extra headers.
 */
import { logger } from '../../lib/logger.js';
import OpenAI from 'openai';
import type { LLMProvider, LLMMessage, LLMOptions, StreamChunk } from './types.js';

const COPILOT_API_BASE = 'https://api.githubcopilot.com';

export class GitHubCopilotProvider implements LLMProvider {
  readonly id = 'github-copilot';
  readonly name = 'GitHub Copilot';
  models: string[] = [];

  private client: OpenAI;

  constructor(token: string, models?: string[]) {
    this.models = models ?? ['claude-opus-4.6', 'claude-sonnet-4.6'];
    this.client = new OpenAI({
      apiKey: token,
      baseURL: COPILOT_API_BASE,
      defaultHeaders: {
        'Copilot-Integration-Id': 'vscode-chat',
      },
    });
  }

  /** Discover available models from the Copilot API */
  static async discoverModels(token: string): Promise<string[]> {
    try {
      const res = await fetch(`${COPILOT_API_BASE}/models`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Copilot-Integration-Id': 'vscode-chat',
        },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const json = await res.json() as { data?: Array<{ id: string }> };
      return json.data?.map(m => m.id) ?? [];
    } catch {
      return [];
    }
  }

  /** Try to load the Copilot token from the OpenClaw credential cache */
  static async loadToken(): Promise<{ token: string; expiresAt: number } | null> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const home = process.env.HOME || '/Users/AI';
      const tokenPath = path.join(home, '.openclaw', 'credentials', 'github-copilot.token.json');

      if (!fs.existsSync(tokenPath)) return null;

      const data = JSON.parse(fs.readFileSync(tokenPath, 'utf-8')) as {
        token?: string;
        expiresAt?: number;
      };

      if (!data.token) return null;

      // Check expiry (with 60s buffer)
      if (data.expiresAt && Date.now() > data.expiresAt - 60_000) {
        logger.warn('[GitHubCopilot] Token expired, skipping');
        return null;
      }

      return { token: data.token, expiresAt: data.expiresAt ?? 0 };
    } catch {
      return null;
    }
  }

  async *chat(messages: LLMMessage[], options: LLMOptions): AsyncGenerator<StreamChunk> {
    const model = options.model ?? 'claude-sonnet-4.6';
    const maxTokens = options.maxTokens ?? 8192;
    const temperature = options.temperature ?? 0.7;

    // Build OpenAI messages
    const oaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (options.systemPrompt) {
      oaiMessages.push({ role: 'system', content: options.systemPrompt });
    }

    for (const m of messages) {
      if (m.role === 'system') continue;

      if (typeof m.content === 'string') {
        if (m.role === 'tool') {
          oaiMessages.push({
            role: 'tool',
            content: m.content,
            tool_call_id: m.toolCallId ?? 'unknown',
          });
        } else {
          oaiMessages.push({ role: m.role as 'user' | 'assistant', content: m.content });
        }
      } else {
        const text = m.content
          .map((b) => {
            if (b.type === 'text') return b.text;
            if (b.type === 'tool_result') return b.content;
            return '';
          })
          .join('');
        if (m.role === 'tool') {
          oaiMessages.push({
            role: 'tool',
            content: text,
            tool_call_id: m.toolCallId ?? 'unknown',
          });
        } else {
          oaiMessages.push({ role: m.role as 'user' | 'assistant', content: text });
        }
      }
    }

    // Build tools
    const tools: OpenAI.Chat.ChatCompletionTool[] | undefined = options.tools?.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    let retries = 0;
    const maxRetries = 3;

    while (retries <= maxRetries) {
      try {
        const stream = this.client.chat.completions.stream({
          model,
          max_tokens: maxTokens,
          temperature,
          messages: oaiMessages,
          tools: tools && tools.length > 0 ? tools : undefined,
          stream: true,
          stream_options: { include_usage: true },
        });

        const toolCallBuffers = new Map<number, { id: string; name: string; argsJson: string }>();
        let inputTokens = 0;
        let outputTokens = 0;

        for await (const chunk of stream) {
          const choice = chunk.choices?.[0];
          if (!choice) continue;

          const delta = choice.delta;

          if (delta.content) {
            yield { type: 'text', text: delta.content };
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCallBuffers.has(idx)) {
                toolCallBuffers.set(idx, {
                  id: tc.id ?? '',
                  name: tc.function?.name ?? '',
                  argsJson: '',
                });
              }
              const buf = toolCallBuffers.get(idx)!;
              if (tc.id) buf.id = tc.id;
              if (tc.function?.name) buf.name += tc.function.name;
              if (tc.function?.arguments) buf.argsJson += tc.function.arguments;
            }
          }

          if (chunk.usage) {
            inputTokens = chunk.usage.prompt_tokens ?? 0;
            outputTokens = chunk.usage.completion_tokens ?? 0;
          }

          if (choice.finish_reason) {
            for (const [, buf] of toolCallBuffers) {
              let input: Record<string, unknown> = {};
              try {
                input = JSON.parse(buf.argsJson) as Record<string, unknown>;
              } catch {
                input = { raw: buf.argsJson };
              }
              yield { type: 'tool_call', id: buf.id, name: buf.name, input };
            }
            toolCallBuffers.clear();

            yield { type: 'usage', inputTokens, outputTokens };
            yield {
              type: 'finish',
              reason: choice.finish_reason === 'tool_calls' ? 'tool_calls'
                : choice.finish_reason === 'stop' ? 'stop'
                : choice.finish_reason === 'length' ? 'max_tokens'
                : 'stop',
            };
            return;
          }
        }

        yield { type: 'finish', reason: 'stop' };
        return;
      } catch (err: unknown) {
        const error = err as Error & { status?: number };
        const isRateLimit = error.status === 429;

        if (isRateLimit && retries < maxRetries) {
          retries++;
          const delay = Math.pow(2, retries) * 1000;
          logger.warn(`[GitHubCopilot] Rate limited, retry ${retries}/${maxRetries} in ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        yield { type: 'finish', reason: 'error' };
        throw err;
      }
    }
  }
}
