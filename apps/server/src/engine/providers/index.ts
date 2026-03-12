import type { LLMProvider, LLMMessage, LLMOptions, StreamChunk } from './types.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { OllamaProvider } from './ollama.js';
import { GitHubCopilotProvider } from './github-copilot.js';
import { logger } from '../../lib/logger.js';

export type { LLMProvider, LLMMessage, LLMOptions, StreamChunk };
export { AnthropicProvider, OpenAIProvider, OllamaProvider, GitHubCopilotProvider };

export class ProviderRouter {
  private providers = new Map<string, LLMProvider>();
  private defaultProviderId: string | null = null;

  register(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
    if (!this.defaultProviderId) this.defaultProviderId = provider.id;
  }

  get(id: string): LLMProvider | undefined {
    return this.providers.get(id);
  }

  getDefault(): LLMProvider | undefined {
    if (!this.defaultProviderId) return undefined;
    return this.providers.get(this.defaultProviderId);
  }

  setDefault(id: string): void {
    if (this.providers.has(id)) {
      this.defaultProviderId = id;
    }
  }

  list(): Array<{ id: string; name: string; models: string[] }> {
    return Array.from(this.providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
      models: p.models,
    }));
  }

  /** Chat with fallback chain — tries each provider in order */
  async *chatWithFallback(
    messages: LLMMessage[],
    options: LLMOptions,
    providerIds?: string[],
  ): AsyncGenerator<StreamChunk> {
    const ids = providerIds ?? (this.defaultProviderId ? [this.defaultProviderId] : []);

    for (let i = 0; i < ids.length; i++) {
      const provider = this.providers.get(ids[i]);
      if (!provider) continue;

      try {
        const gen = provider.chat(messages, options);
        let hasError = false;

        for await (const chunk of gen) {
          if (chunk.type === 'finish' && chunk.reason === 'error' && i < ids.length - 1) {
            hasError = true;
            break;
          }
          yield chunk;
        }

        if (!hasError) return;

        logger.warn(`[ProviderRouter] Provider ${ids[i]} failed, trying fallback...`);
      } catch (err) {
        if (i < ids.length - 1) {
          logger.warn(`[ProviderRouter] Provider ${ids[i]} threw, trying fallback: %s`, (err as Error).message);
          continue;
        }
        throw err;
      }
    }

    yield { type: 'finish', reason: 'error' };
  }
}

// Global singleton router
let routerInstance: ProviderRouter | null = null;

export function getProviderRouter(): ProviderRouter {
  if (!routerInstance) routerInstance = new ProviderRouter();
  return routerInstance;
}

export async function initProviders(config: {
  anthropic?: { apiKey: string; defaultModel?: string };
  openai?: { apiKey: string; defaultModel?: string };
  copilot?: { token: string };
  defaults?: { provider?: string };
}): Promise<ProviderRouter> {
  const router = getProviderRouter();

  if (config.anthropic?.apiKey) {
    router.register(new AnthropicProvider(config.anthropic.apiKey));
  }

  if (config.openai?.apiKey) {
    router.register(new OpenAIProvider(config.openai.apiKey));
  }

  // Ollama (local) — always try to connect, silently skip if not running
  try {
    const ollamaBaseUrl = 'http://localhost:11434';
    const ollamaModels = await OllamaProvider.discoverModels(ollamaBaseUrl);
    if (ollamaModels.length > 0) {
      router.register(new OllamaProvider({ baseUrl: ollamaBaseUrl, models: ollamaModels }));
      logger.info(`   Providers: Ollama (${ollamaModels.length} models)`);
    }
  } catch {
    /* Ollama not available */
  }

  // GitHub Copilot — try to load token from OpenClaw credential cache or environment
  try {
    const copilotToken = config.copilot?.token || null;
    const tokenData = copilotToken ? { token: copilotToken, expiresAt: 0 } : await GitHubCopilotProvider.loadToken();
    if (tokenData) {
      const copilotModels = await GitHubCopilotProvider.discoverModels(tokenData.token);
      if (copilotModels.length > 0) {
        router.register(new GitHubCopilotProvider(tokenData.token, copilotModels));
        logger.info(`   Providers: GitHub Copilot (${copilotModels.length} models)`);
      }
    }
  } catch {
    /* GitHub Copilot not available */
  }

  if (config.defaults?.provider) {
    router.setDefault(config.defaults.provider);
  }

  return router;
}
