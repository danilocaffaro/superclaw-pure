import { logger } from '../../lib/logger.js';
import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMMessage, LLMOptions, StreamChunk, LLMContentBlock } from './types.js';

export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic';
  readonly models = [
    'claude-opus-4-20250514',
    'claude-sonnet-4-20250514',
    'claude-haiku-4-20251001',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
  ];

  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async *chat(messages: LLMMessage[], options: LLMOptions): AsyncGenerator<StreamChunk> {
    const model = options.model ?? 'claude-sonnet-4-20250514';
    const maxTokens = options.maxTokens ?? 8192;
    const temperature = options.temperature ?? 0.7;

    // Separate system prompt from messages
    const systemPrompt = options.systemPrompt ?? '';
    const filteredMessages = messages.filter((m) => m.role !== 'system');

    // Convert messages to Anthropic format
    const anthropicMessages: Anthropic.MessageParam[] = filteredMessages.map((m) => {
      if (typeof m.content === 'string') {
        return { role: m.role as 'user' | 'assistant', content: m.content };
      }
      // Convert content blocks
      const blocks: Anthropic.ContentBlockParam[] = (m.content as LLMContentBlock[]).map((b) => {
        if (b.type === 'text') return { type: 'text' as const, text: b.text };
        if (b.type === 'tool_use') return {
          type: 'tool_use' as const,
          id: b.id,
          name: b.name,
          input: b.input,
        };
        if (b.type === 'tool_result') return {
          type: 'tool_result' as const,
          tool_use_id: b.tool_use_id,
          content: b.content,
          is_error: b.is_error,
        };
        return { type: 'text' as const, text: JSON.stringify(b) };
      });
      return { role: m.role as 'user' | 'assistant', content: blocks };
    });

    // Convert tools
    const tools: Anthropic.Tool[] | undefined = options.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool.InputSchema,
    }));

    let retries = 0;
    const maxRetries = 3;

    while (retries <= maxRetries) {
      try {
        const stream = this.client.messages.stream({
          model,
          max_tokens: maxTokens,
          temperature,
          system: systemPrompt || undefined,
          messages: anthropicMessages,
          tools: tools && tools.length > 0 ? tools : undefined,
        });

        // Track tool calls being built
        const toolCallBuffers = new Map<number, { id: string; name: string; inputJson: string }>();

        for await (const event of stream) {
          if (event.type === 'content_block_start') {
            if (event.content_block.type === 'tool_use') {
              toolCallBuffers.set(event.index, {
                id: event.content_block.id,
                name: event.content_block.name,
                inputJson: '',
              });
            }
          } else if (event.type === 'content_block_delta') {
            if (event.delta.type === 'text_delta') {
              yield { type: 'text', text: event.delta.text };
            } else if (event.delta.type === 'input_json_delta') {
              const buf = toolCallBuffers.get(event.index);
              if (buf) buf.inputJson += event.delta.partial_json;
            }
          } else if (event.type === 'content_block_stop') {
            const buf = toolCallBuffers.get(event.index);
            if (buf) {
              let input: Record<string, unknown> = {};
              try {
                input = JSON.parse(buf.inputJson) as Record<string, unknown>;
              } catch {
                input = { raw: buf.inputJson };
              }
              yield { type: 'tool_call', id: buf.id, name: buf.name, input };
              toolCallBuffers.delete(event.index);
            }
          } else if (event.type === 'message_delta') {
            if (event.usage) {
              // output tokens update
            }
            if (event.delta.stop_reason === 'tool_use') {
              // Will be followed by message_stop
            }
          } else if (event.type === 'message_start') {
            if (event.message.usage) {
              yield {
                type: 'usage',
                inputTokens: event.message.usage.input_tokens,
                outputTokens: event.message.usage.output_tokens,
              };
            }
          } else if (event.type === 'message_stop') {
            // done
          }
        }

        const finalMessage = await stream.finalMessage();
        yield {
          type: 'usage',
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
        };

        const stopReason = finalMessage.stop_reason;
        yield {
          type: 'finish',
          reason: stopReason === 'tool_use' ? 'tool_calls'
            : stopReason === 'end_turn' ? 'stop'
            : stopReason === 'max_tokens' ? 'max_tokens'
            : 'stop',
        };
        return;
      } catch (err: unknown) {
        const error = err as Error & { status?: number; headers?: Record<string, string> };
        const isRateLimit = error.status === 429;
        const isOverloaded = error.status === 529;

        if ((isRateLimit || isOverloaded) && retries < maxRetries) {
          retries++;
          const delay = Math.pow(2, retries) * 1000;
          logger.warn(`[Anthropic] Rate limited, retry ${retries}/${maxRetries} in ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        yield { type: 'finish', reason: 'error' };
        throw err;
      }
    }
  }
}
