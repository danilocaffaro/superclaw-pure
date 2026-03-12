import { logger } from '../../lib/logger.js';
import OpenAI from 'openai';
import type { LLMProvider, LLMMessage, LLMOptions, StreamChunk } from './types.js';

export class OpenAIProvider implements LLMProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  readonly models = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
    'o1',
    'o1-mini',
    'o3-mini',
  ];

  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async *chat(messages: LLMMessage[], options: LLMOptions): AsyncGenerator<StreamChunk> {
    const model = options.model ?? 'gpt-4o';
    const maxTokens = options.maxTokens ?? 8192;
    const temperature = options.temperature ?? 0.7;

    // Build OpenAI messages
    const oaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (options.systemPrompt) {
      oaiMessages.push({ role: 'system', content: options.systemPrompt });
    }

    for (const m of messages) {
      if (m.role === 'system') continue; // already handled

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
        // Complex content — convert to string for user messages
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
            // Flush tool calls
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
          logger.warn(`[OpenAI] Rate limited, retry ${retries}/${maxRetries} in ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        yield { type: 'finish', reason: 'error' };
        throw err;
      }
    }
  }
}
