import { describe, it, expect } from 'vitest';
import {
  classifyComplexity,
  classifyTask,
  getModelQuality,
  qualityToTier,
  selectModelForTask,
  buildTierConfig,
  QUALITY_FLOORS,
} from '../engine/smart-router.js';

// ─── Mock ProviderRepository ────────────────────────────────────────────────────

function mockProviders(models: Array<{ providerId: string; modelId: string; enabled?: boolean }>) {
  const providers = new Map<string, { id: string; enabled: boolean; models: string[] }>();
  for (const m of models) {
    const existing = providers.get(m.providerId);
    if (existing) {
      existing.models.push(m.modelId);
    } else {
      providers.set(m.providerId, {
        id: m.providerId,
        enabled: m.enabled ?? true,
        models: [m.modelId],
      });
    }
  }
  return {
    list: () => [...providers.values()],
  } as any;
}

// ─── classifyComplexity (backward compat) ───────────────────────────────────────

describe('SmartRouter — classifyComplexity', () => {
  it('should route heartbeat to cheap tier', () => {
    const result = classifyComplexity({
      userMessage: 'Check if the gateway is healthy',
      historyLength: 0,
      isHeartbeat: true,
    });
    expect(result.tier).toBe('cheap');
  });

  it('should route cron to cheap tier', () => {
    const result = classifyComplexity({
      userMessage: 'Run daily report',
      historyLength: 1,
      isCron: true,
    });
    expect(result.tier).toBe('cheap');
  });

  it('should route short greeting to cheap tier', () => {
    const result = classifyComplexity({
      userMessage: 'hi',
      historyLength: 0,
    });
    expect(result.tier).toBe('cheap');
  });

  it('should route complex analysis to premium tier', () => {
    const result = classifyComplexity({
      userMessage: 'Please analyze and evaluate the architecture of this system, compare trade-offs, and design a better approach',
      historyLength: 5,
    });
    expect(result.tier).toBe('premium');
  });

  it('should route short message with minimal context to cheap tier', () => {
    const result = classifyComplexity({
      userMessage: 'What time is it?',
      historyLength: 0,
    });
    expect(result.tier).toBe('cheap');
  });

  it('should route general chat to cheap tier (quality floor 50 maps to cheap)', () => {
    const result = classifyComplexity({
      userMessage: 'Can you help me write a Python script to process CSV files?',
      historyLength: 3,
    });
    // Chat task has floor 50, qualityToTier(50) = cheap (< 55)
    // The actual model selection uses quality-aware routing, not tier
    expect(result.tier).toBe('cheap');
  });

  it('should respect agent-level tier override', () => {
    const result = classifyComplexity({
      userMessage: 'Analyze and compare all architectural patterns',
      historyLength: 50,
      agentTier: 'cheap',
    });
    expect(result.tier).toBe('cheap');
    expect(result.reason).toContain('Agent configured');
  });

  it('should route long context to premium tier', () => {
    const result = classifyComplexity({
      userMessage: 'Continue where we left off',
      historyLength: 10,
      totalContextTokens: 90_000,
    });
    expect(result.tier).toBe('premium');
  });
});

// ─── classifyTask ───────────────────────────────────────────────────────────────

describe('SmartRouter — classifyTask', () => {
  it('should classify heartbeat', () => {
    const { task } = classifyTask({ userMessage: 'ping', historyLength: 0, isHeartbeat: true });
    expect(task).toBe('heartbeat');
  });

  it('should classify greeting', () => {
    const { task } = classifyTask({ userMessage: 'oi', historyLength: 0 });
    expect(task).toBe('greeting');
  });

  it('should classify complex reasoning', () => {
    const { task } = classifyTask({
      userMessage: 'Analyze the architecture and evaluate security trade-offs in detail',
      historyLength: 5,
    });
    expect(task).toBe('complex_reasoning');
  });

  it('should respect explicit systemTask', () => {
    const { task } = classifyTask({
      userMessage: 'summarize this',
      historyLength: 0,
      systemTask: 'compaction',
    });
    expect(task).toBe('compaction');
  });
});

// ─── Quality Scores ─────────────────────────────────────────────────────────────

describe('SmartRouter — getModelQuality', () => {
  it('should return exact match score', () => {
    expect(getModelQuality('anthropic', 'claude-opus-4')).toBe(95);
    expect(getModelQuality('openai', 'gpt-4o-mini')).toBe(72);
    expect(getModelQuality('google', 'gemini-2.5-flash')).toBe(75);
  });

  it('should fuzzy match model ids', () => {
    // "claude-sonnet-4-5-20250514" should match "claude-sonnet-4-5"
    expect(getModelQuality('anthropic', 'claude-sonnet-4-5-20250514')).toBe(88);
  });

  it('should infer quality from pricing for unknown models', () => {
    const q = getModelQuality('custom', 'totally-unknown-model');
    expect(q).toBeGreaterThanOrEqual(0);
    expect(q).toBeLessThanOrEqual(100);
  });

  it('should score local/free models as mid-low', () => {
    expect(getModelQuality('ollama', 'some-unknown-local')).toBe(40);
  });
});

describe('SmartRouter — qualityToTier', () => {
  it('should map scores to tiers correctly', () => {
    expect(qualityToTier(95)).toBe('premium');
    expect(qualityToTier(80)).toBe('premium');
    expect(qualityToTier(70)).toBe('standard');
    expect(qualityToTier(55)).toBe('standard');
    expect(qualityToTier(40)).toBe('cheap');
    expect(qualityToTier(10)).toBe('cheap');
  });
});

// ─── Quality-Aware Selection ────────────────────────────────────────────────────

describe('SmartRouter — selectModelForTask', () => {
  it('should pick cheapest model above quality floor', () => {
    const providers = mockProviders([
      { providerId: 'openai', modelId: 'gpt-4o' },        // quality 90, cost ~6.25
      { providerId: 'openai', modelId: 'gpt-4o-mini' },   // quality 72, cost ~0.375
      { providerId: 'anthropic', modelId: 'claude-opus-4' }, // quality 95, cost ~45
    ]);

    // Chat needs floor 50 → gpt-4o-mini (72, cheapest above 50)
    const result = selectModelForTask('chat', providers);
    expect(result).not.toBeNull();
    expect(result!.modelId).toBe('gpt-4o-mini');
    expect(result!.meetsFloor).toBe(true);
  });

  it('should use best available with warning when no model meets floor', () => {
    const providers = mockProviders([
      { providerId: 'ollama', modelId: 'llama3.2:3b' },   // quality 30
      { providerId: 'ollama', modelId: 'gemma2:2b' },     // quality 28
    ]);

    // complex_reasoning needs floor 80 → nothing qualifies
    const result = selectModelForTask('complex_reasoning', providers);
    expect(result).not.toBeNull();
    expect(result!.meetsFloor).toBe(false);
    expect(result!.qualityWarning).toContain('Quality warning');
    // Should pick the best (llama3.2:3b = 30 > gemma2:2b = 28)
    expect(result!.modelId).toBe('llama3.2:3b');
  });

  it('should return null when no providers available', () => {
    const providers = mockProviders([]);
    const result = selectModelForTask('chat', providers);
    expect(result).toBeNull();
  });

  it('should pick very cheap model for heartbeats (low floor)', () => {
    const providers = mockProviders([
      { providerId: 'ollama', modelId: 'qwen2.5:7b' },   // quality 42, cost 0
      { providerId: 'openai', modelId: 'gpt-4o' },        // quality 90, cost ~6.25
    ]);

    // Heartbeat needs floor 20 → qwen (free, quality 42 > 20)
    const result = selectModelForTask('heartbeat', providers);
    expect(result).not.toBeNull();
    expect(result!.modelId).toBe('qwen2.5:7b');
    expect(result!.meetsFloor).toBe(true);
  });
});

// ─── buildTierConfig ────────────────────────────────────────────────────────────

describe('SmartRouter — buildTierConfig', () => {
  it('should build tiers from quality scores', () => {
    const providers = mockProviders([
      { providerId: 'openai', modelId: 'gpt-4o' },
      { providerId: 'openai', modelId: 'gpt-4o-mini' },
      { providerId: 'ollama', modelId: 'qwen2.5:7b' },
    ]);

    const config = buildTierConfig(providers);
    // qwen = cheap (42), gpt-4o-mini = standard (72), gpt-4o = premium (90)
    expect(config.cheap?.modelId).toBe('qwen2.5:7b');
    expect(config.standard?.modelId).toBe('gpt-4o-mini');
    expect(config.premium?.modelId).toBe('gpt-4o');
  });

  it('should fill standard from premium when no standard models exist', () => {
    const providers = mockProviders([
      { providerId: 'openai', modelId: 'gpt-4o' },
    ]);

    const config = buildTierConfig(providers);
    expect(config.premium?.modelId).toBe('gpt-4o');
    expect(config.standard?.modelId).toBe('gpt-4o'); // filled from premium
  });
});
