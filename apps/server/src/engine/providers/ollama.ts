import type { LLMProvider, LLMMessage, LLMOptions, StreamChunk } from './types.js';
import { PROVIDER_BASE_URLS } from '../../config/defaults.js';

export class OllamaProvider implements LLMProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama (Local)';
  // models is populated at construction time via discoverModels()
  readonly models: string[];

  private baseUrl: string;

  constructor(config: { baseUrl?: string; models?: string[] }) {
    this.baseUrl = config.baseUrl || PROVIDER_BASE_URLS.ollama;
    this.models = config.models || [];
  }

  /**
   * Fetch available models from Ollama. Returns [] if Ollama is not running.
   */
  static async discoverModels(baseUrl = PROVIDER_BASE_URLS.ollama): Promise<string[]> {
    try {
      const res = await fetch(`${baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { models?: Array<{ name: string }> };
      return (data.models || []).map((m) => m.name);
    } catch {
      return []; // Ollama not running — silently skip
    }
  }

  async *chat(messages: LLMMessage[], options: LLMOptions): AsyncGenerator<StreamChunk> {
    const model = options.model || this.models[0] || 'llama3.1';

    // Flatten LLMMessage content to string
    const flattenContent = (m: LLMMessage): string => {
      if (typeof m.content === 'string') return m.content;
      return m.content
        .map((b) => {
          if (b.type === 'text') return b.text;
          if (b.type === 'tool_result') return b.content;
          return '';
        })
        .join('');
    };

    // Build Ollama messages array
    const ollamaMessages: Array<{ role: string; content: string }> = [];

    if (options.systemPrompt) {
      ollamaMessages.push({ role: 'system', content: options.systemPrompt });
    }

    for (const m of messages) {
      if (m.role === 'system') continue; // handled above
      ollamaMessages.push({
        role: m.role === 'tool' ? 'user' : m.role,
        content: flattenContent(m),
      });
    }

    const body = {
      model,
      messages: ollamaMessages,
      stream: true,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 4096,
      },
    };

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Ollama error: ${res.status} ${await res.text()}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    let totalTokensIn = 0;
    let totalTokensOut = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line) as {
            message?: { content?: string };
            done?: boolean;
            prompt_eval_count?: number;
            eval_count?: number;
          };
          if (data.message?.content) {
            yield { type: 'text', text: data.message.content };
          }
          if (data.done) {
            totalTokensIn = data.prompt_eval_count || 0;
            totalTokensOut = data.eval_count || 0;
          }
        } catch {
          /* skip malformed lines */
        }
      }
    }

    yield {
      type: 'usage',
      inputTokens: totalTokensIn,
      outputTokens: totalTokensOut,
    };

    yield { type: 'finish', reason: 'stop' };
  }
}
