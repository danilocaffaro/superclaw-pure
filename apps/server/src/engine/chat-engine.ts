/**
 * Native Chat Engine — handles native LLM communication.
 * Supports OpenAI-compatible and Anthropic native APIs.
 * Streaming via async generators.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model: string;
  baseUrl: string;
  apiKey?: string;
  providerType: 'openai' | 'anthropic';
  temperature?: number;
  maxTokens?: number;
  extraHeaders?: Record<string, string>;
  tools?: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
}

export interface StreamDelta {
  type: 'delta' | 'done' | 'error' | 'tool_call';
  content?: string;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
  toolCall?: { id: string; name: string; arguments: string };
}

// ─── OpenAI-Compatible Streaming ────────────────────────────────────────

async function* streamOpenAI(messages: ChatMessage[], opts: ChatOptions): AsyncGenerator<StreamDelta> {
  // GitHub Copilot enterprise endpoint uses /chat/completions (no /v1/ prefix)
  const base = opts.baseUrl.replace(/\/$/, '');
  const isCopilot = base.includes('githubcopilot.com');
  const url = isCopilot ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.apiKey) headers['Authorization'] = `Bearer ${opts.apiKey}`;
  if (opts.extraHeaders) Object.assign(headers, opts.extraHeaders);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: opts.model,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 4096,
        stream: true,
        stream_options: { include_usage: true },
        ...(opts.tools && opts.tools.length > 0 ? {
          tools: opts.tools.map(t => ({
            type: 'function',
            function: { name: t.name, description: t.description, parameters: t.parameters },
          })),
        } : {}),
      }),
    });
  } catch (err: any) {
    yield { type: 'error', error: `Connection failed: ${err.message}` };
    return;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown');
    yield { type: 'error', error: `LLM error ${res.status}: ${text.slice(0, 300)}` };
    return;
  }
  if (!res.body) {
    yield { type: 'error', error: 'No response body' };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let tokensIn = 0, tokensOut = 0;
  const pendingToolCalls: Array<{ id: string; name: string; arguments: string } | undefined> = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') {
          yield { type: 'done', tokensIn, tokensOut };
          return;
        }
        try {
          const data = JSON.parse(payload);
          const choice = data.choices?.[0];
          const delta = choice?.delta;
          // Text content
          if (delta?.content) yield { type: 'delta', content: delta.content };
          // Tool calls (streamed in chunks)
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls as Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }>) {
              if (tc.function?.name) {
                // First chunk of a tool call — accumulate in pendingToolCalls
                if (!pendingToolCalls[tc.index]) {
                  pendingToolCalls[tc.index] = { id: tc.id ?? '', name: tc.function.name, arguments: tc.function.arguments ?? '' };
                } else {
                  pendingToolCalls[tc.index]!.arguments += tc.function.arguments ?? '';
                }
              } else if (tc.function?.arguments && pendingToolCalls[tc.index]) {
                pendingToolCalls[tc.index]!.arguments += tc.function.arguments;
              }
            }
          }
          // Finish reason — emit accumulated tool calls
          if (choice?.finish_reason === 'tool_calls' || choice?.finish_reason === 'stop') {
            for (const ptc of pendingToolCalls) {
              if (ptc) yield { type: 'tool_call', toolCall: ptc };
            }
          }
          // Track usage if provided
          if (data.usage) {
            tokensIn = data.usage.prompt_tokens ?? tokensIn;
            tokensOut = data.usage.completion_tokens ?? tokensOut;
          }
        } catch { /* skip malformed chunks */ }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { type: 'done', tokensIn, tokensOut };
}

// ─── Anthropic Native Streaming ─────────────────────────────────────────

async function* streamAnthropic(messages: ChatMessage[], opts: ChatOptions): AsyncGenerator<StreamDelta> {
  const url = `${opts.baseUrl.replace(/\/$/, '')}/v1/messages`;

  const systemMsg = messages.find(m => m.role === 'system');
  const chatMsgs = messages.filter(m => m.role !== 'system');

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': opts.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 4096,
        stream: true,
        ...(systemMsg ? { system: systemMsg.content } : {}),
        messages: chatMsgs.map(m => ({ role: m.role, content: m.content })),
      }),
    });
  } catch (err: any) {
    yield { type: 'error', error: `Connection failed: ${err.message}` };
    return;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown');
    yield { type: 'error', error: `Anthropic error ${res.status}: ${text.slice(0, 300)}` };
    return;
  }
  if (!res.body) {
    yield { type: 'error', error: 'No response body' };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let tokensIn = 0, tokensOut = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        try {
          const data = JSON.parse(payload);
          if (data.type === 'content_block_delta' && data.delta?.text) {
            yield { type: 'delta', content: data.delta.text };
          }
          if (data.type === 'message_delta' && data.usage) {
            tokensOut = data.usage.output_tokens ?? tokensOut;
          }
          if (data.type === 'message_start' && data.message?.usage) {
            tokensIn = data.message.usage.input_tokens ?? tokensIn;
          }
        } catch { /* skip */ }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { type: 'done', tokensIn, tokensOut };
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Stream a chat completion from any supported provider.
 * Yields deltas followed by a final 'done' event with token counts.
 */
export function streamChat(messages: ChatMessage[], opts: ChatOptions): AsyncGenerator<StreamDelta> {
  if (opts.providerType === 'anthropic') {
    return streamAnthropic(messages, opts);
  }
  return streamOpenAI(messages, opts);
}

/**
 * Non-streaming completion (convenience wrapper).
 */
export async function chatComplete(messages: ChatMessage[], opts: ChatOptions): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  let content = '';
  let tokensIn = 0, tokensOut = 0;

  for await (const delta of streamChat(messages, opts)) {
    if (delta.type === 'delta' && delta.content) content += delta.content;
    if (delta.type === 'done') {
      tokensIn = delta.tokensIn ?? 0;
      tokensOut = delta.tokensOut ?? 0;
    }
    if (delta.type === 'error') throw new Error(delta.error);
  }

  return { content, tokensIn, tokensOut };
}
