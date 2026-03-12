/**
 * engine/smart-router.ts — Quality-aware automatic model routing
 *
 * Routes tasks to the cheapest model that meets the quality floor.
 *
 * Design principle: "minimum quality, minimum cost"
 *   1. Each system task declares a QUALITY FLOOR (capability requirement)
 *   2. All user-available models get a quality score (0-100)
 *   3. Router picks the cheapest model that meets the floor
 *   4. If NO model meets the floor → uses best available + emits quality warning
 *
 * Quality scores come from:
 *   - Known model database (MODEL_QUALITY below)
 *   - Pricing-based inference (expensive = probably better)
 *   - User overrides in DB (future)
 */

import { ProviderRepository } from '../db/index.js';
import { getModelPricing, type ModelPricing } from '../config/pricing.js';
import { logger } from '../lib/logger.js';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type ModelTier = 'cheap' | 'standard' | 'premium';

export interface TierConfig {
  cheap: { providerId: string; modelId: string } | null;
  standard: { providerId: string; modelId: string } | null;
  premium: { providerId: string; modelId: string } | null;
}

export interface RoutingDecision {
  tier: ModelTier;
  providerId: string;
  modelId: string;
  reason: string;
  qualityWarning?: string;
}

// ─── Quality Scores (0-100) ─────────────────────────────────────────────────────
//
// Score represents general capability. Sources:
//   - LMSYS Chatbot Arena ELO (normalized)
//   - Provider benchmarks (MMLU, HumanEval, etc.)
//   - Practical experience
//
// Users can override via DB (future: model_quality_overrides table)
//
// Score bands:
//   90-100  = Frontier (Opus, GPT-4o, Gemini Pro)
//   70-89   = Strong (Sonnet, GPT-4o-mini, Gemini Flash 2.5)
//   50-69   = Capable (Haiku, Gemini Flash 2.0, small local)
//   30-49   = Basic (3.5-turbo, tiny local models)
//   0-29    = Minimal (very small models, quantized)

const MODEL_QUALITY: Record<string, number> = {
  // ── Anthropic ────────────────────────────────────────────────
  'claude-opus-4':           95,
  'claude-opus-4.6':         95,
  'claude-opus-4-5':         95,
  'claude-3-opus':           92,
  'claude-sonnet-4':         88,
  'claude-sonnet-4-5':       88,
  'claude-sonnet-4.6':       88,
  'claude-3-5-sonnet':       87,
  'claude-haiku-4-5':        68,
  'claude-3-5-haiku':        68,

  // ── OpenAI ───────────────────────────────────────────────────
  'gpt-4o':                  90,
  'gpt-4-turbo':             88,
  'gpt-4':                   85,
  'o1':                      93,
  'o1-pro':                  95,
  'o1-mini':                 75,
  'o3':                      95,
  'o3-mini':                 78,
  'o4-mini':                 78,
  'gpt-4o-mini':             72,
  'gpt-3.5-turbo':           45,

  // ── Google ───────────────────────────────────────────────────
  'gemini-2.5-pro':          92,
  'gemini-2.5-flash':        75,
  'gemini-2.0-flash':        65,
  'gemini-1.5-pro':          85,
  'gemini-1.5-flash':        60,

  // ── DeepSeek ─────────────────────────────────────────────────
  'deepseek-chat':           70,
  'deepseek-reasoner':       85,

  // ── Groq-hosted ──────────────────────────────────────────────
  'llama-3.3-70b':           78,
  'llama-3.1-70b':           75,
  'llama-3.1-8b':            45,
  'mixtral-8x7b':            55,

  // ── Mistral ──────────────────────────────────────────────────
  'mistral-large':           82,
  'mistral-small':           55,
  'codestral':               70,

  // ── Common local models (Ollama) ─────────────────────────────
  'qwen2.5:72b':             78,
  'qwen2.5:32b':             68,
  'qwen2.5:14b':             55,
  'qwen2.5:7b':              42,
  'qwen3:8b':                50,
  'qwen3:32b':               72,
  'llama3.1:8b':             45,
  'llama3.1:70b':            75,
  'llama3.2:3b':             30,
  'llama3.3:70b':            78,
  'deepseek-r1:32b':         72,
  'deepseek-r1:14b':         58,
  'deepseek-r1:8b':          42,
  'phi3:14b':                55,
  'phi3:3.8b':               35,
  'gemma2:27b':              65,
  'gemma2:9b':               48,
  'gemma2:2b':               28,
  'mistral:7b':              42,
  'mixtral:8x7b':            55,
  'codellama:34b':           60,
  'codellama:7b':            38,
  'nomic-embed-text':        0,  // Embedding model, not for chat
};

// ─── Quality Floor per System Task ──────────────────────────────────────────────
//
// Each task type specifies the minimum quality score a model must have.
// Below this threshold, the task may produce unreliable results.

export type SystemTask =
  | 'chat'               // General conversation
  | 'heartbeat'          // Health checks, cron
  | 'greeting'           // "Hi", "thanks"
  | 'compaction'         // Summarize old messages before deletion
  | 'extraction'         // Extract facts/entities/decisions from text
  | 'embedding'          // Generate embeddings (dedicated model)
  | 'tool_heavy'         // Multi-step tool use, coding
  | 'complex_reasoning'; // Architecture, analysis, deep review

export const QUALITY_FLOORS: Record<SystemTask, number> = {
  heartbeat:          20,   // Trivial — anything works
  greeting:           30,   // Simple response — basic models OK
  chat:               50,   // General conversation — needs coherent reasoning
  compaction:         60,   // Must understand context to summarize well
  extraction:         60,   // Must parse semantics reliably
  embedding:           0,   // Dedicated model, not quality-scored
  tool_heavy:         75,   // Needs reliable tool calling + reasoning
  complex_reasoning:  80,   // Needs frontier-level capability
};

// ─── Model Quality Resolution ───────────────────────────────────────────────────

/**
 * Get quality score for a model. Resolution order:
 * 1. Exact match in MODEL_QUALITY
 * 2. Fuzzy substring match
 * 3. Inference from pricing (expensive ≈ better)
 */
export function getModelQuality(providerId: string, modelId: string): number {
  const modelLower = modelId.toLowerCase();

  // 1. Exact match
  if (MODEL_QUALITY[modelId] !== undefined) return MODEL_QUALITY[modelId];

  // 2. Fuzzy substring match (check both directions)
  for (const [key, score] of Object.entries(MODEL_QUALITY)) {
    const keyLower = key.toLowerCase();
    if (modelLower.includes(keyLower) || keyLower.includes(modelLower)) {
      return score;
    }
  }

  // 3. Infer from pricing — expensive models tend to be better
  //    $0/1M = 40 (local free), $0.1 = 55, $1 = 65, $3 = 80, $10 = 88, $15+ = 92
  const pricing = getModelPricing(providerId, modelId);
  const avgCost = (pricing.in + pricing.out) / 2;
  if (avgCost === 0) return 40;  // Free/local — assume mid-low
  if (avgCost < 0.5) return 55;
  if (avgCost < 2) return 65;
  if (avgCost < 5) return 80;
  if (avgCost < 15) return 88;
  return 92;
}

/**
 * Derive a tier label from quality score (for backward compatibility with UI).
 */
export function qualityToTier(quality: number): ModelTier {
  if (quality >= 80) return 'premium';
  if (quality >= 55) return 'standard';
  return 'cheap';
}

// ─── Complexity Classification ──────────────────────────────────────────────────

export interface RoutingContext {
  userMessage: string;
  historyLength: number;       // number of messages in session
  totalContextTokens?: number; // estimated tokens in context
  isHeartbeat?: boolean;       // heartbeat/cron task
  isCron?: boolean;            // scheduled task
  hasToolUse?: boolean;        // previous messages used tools
  agentTier?: ModelTier;       // agent-level override
  systemTask?: SystemTask;     // explicit system task type
}

/**
 * Classify a request into a system task.
 */
export function classifyTask(ctx: RoutingContext): { task: SystemTask; reason: string } {
  // Explicit override
  if (ctx.systemTask) {
    return { task: ctx.systemTask, reason: `Explicit system task: ${ctx.systemTask}` };
  }

  // Heartbeat/cron
  if (ctx.isHeartbeat || ctx.isCron) {
    return { task: 'heartbeat', reason: 'Heartbeat/cron task' };
  }

  const msgLen = ctx.userMessage.length;
  const histLen = ctx.historyLength;
  const contextTokens = ctx.totalContextTokens ?? 0;

  // Simple greeting
  const simplePatterns = /^(hi|hello|hey|thanks|ok|yes|no|sure|good|great|fine|oi|obrigado|valeu|ok)\b/i;
  if (simplePatterns.test(ctx.userMessage.trim()) && msgLen < 50) {
    return { task: 'greeting', reason: 'Simple greeting/acknowledgment' };
  }

  // Complex reasoning
  const complexPatterns = [
    /\b(analyze|analyse|compare|evaluate|architect|design|refactor|debug)\b/i,
    /\b(step[ -]by[ -]step|break down|explain in detail|deep dive)\b/i,
    /\b(pros and cons|trade-?offs|alternatives|implications)\b/i,
    /\b(implement|build|create|develop)\b.*\b(system|engine|framework|architecture)\b/i,
    /\b(review|audit|security|vulnerability|performance)\b/i,
  ];
  const complexMatchCount = complexPatterns.filter(p => p.test(ctx.userMessage)).length;
  if (complexMatchCount >= 2) {
    return { task: 'complex_reasoning', reason: `Complex reasoning (${complexMatchCount} indicators)` };
  }

  // Tool-heavy
  if (ctx.hasToolUse && histLen > 10 && msgLen > 500) {
    return { task: 'tool_heavy', reason: 'Active tool-use session with significant context' };
  }
  if (contextTokens > 80_000) {
    return { task: 'complex_reasoning', reason: `Large context (${contextTokens} tokens)` };
  }
  if (msgLen > 2000 && histLen > 20) {
    return { task: 'complex_reasoning', reason: 'Long message + extensive history' };
  }

  // Short simple question
  if (msgLen < 100 && histLen <= 2 && !ctx.hasToolUse) {
    return { task: 'chat', reason: 'Short message, minimal context' };
  }

  return { task: 'chat', reason: 'General conversation' };
}

/**
 * classifyComplexity — backward-compatible wrapper that maps task → tier.
 */
export function classifyComplexity(ctx: RoutingContext): { tier: ModelTier; reason: string } {
  // Agent-level override
  if (ctx.agentTier) {
    return { tier: ctx.agentTier, reason: `Agent configured for ${ctx.agentTier} tier` };
  }
  const { task, reason } = classifyTask(ctx);
  const floor = QUALITY_FLOORS[task];
  return { tier: qualityToTier(floor), reason };
}

// ─── Available Model Inventory ──────────────────────────────────────────────────

interface ScoredModel {
  providerId: string;
  modelId: string;
  quality: number;
  costPer1M: number;   // average of in+out per 1M tokens
}

/**
 * Build a scored inventory of all available models from user's providers.
 */
function buildModelInventory(providers: ProviderRepository): ScoredModel[] {
  const models: ScoredModel[] = [];

  for (const provider of providers.list()) {
    if (!provider.enabled) continue;
    for (const model of provider.models) {
      const modelId = typeof model === 'string' ? model : model.id;
      const quality = getModelQuality(provider.id, modelId);
      const pricing = getModelPricing(provider.id, modelId);
      const costPer1M = (pricing.in + pricing.out) / 2;
      models.push({ providerId: provider.id, modelId, quality, costPer1M });
    }
  }

  return models;
}

// ─── Quality-Aware Model Selection ──────────────────────────────────────────────

export interface QualityRoutingResult {
  providerId: string;
  modelId: string;
  quality: number;
  costPer1M: number;
  meetsFloor: boolean;
  qualityWarning?: string;
}

/**
 * Select the cheapest model that meets the quality floor for a task.
 *
 * If no model meets the floor:
 *   → Uses the BEST available model (highest quality)
 *   → Returns a qualityWarning explaining the gap
 */
export function selectModelForTask(
  task: SystemTask,
  providers: ProviderRepository,
): QualityRoutingResult | null {
  const floor = QUALITY_FLOORS[task];
  const inventory = buildModelInventory(providers);

  if (inventory.length === 0) return null;

  // Filter models that meet the quality floor
  const qualified = inventory.filter(m => m.quality >= floor);

  if (qualified.length > 0) {
    // Sort by cost ascending (cheapest first), tie-break by quality descending
    qualified.sort((a, b) => a.costPer1M - b.costPer1M || b.quality - a.quality);
    const pick = qualified[0];
    return {
      providerId: pick.providerId,
      modelId: pick.modelId,
      quality: pick.quality,
      costPer1M: pick.costPer1M,
      meetsFloor: true,
    };
  }

  // No model meets the floor — use the best available
  inventory.sort((a, b) => b.quality - a.quality);
  const best = inventory[0];
  const warning = `⚠️ Quality warning: Task "${task}" requires quality ≥${floor}, ` +
    `but best available model "${best.modelId}" scores ${best.quality}. ` +
    `Results may be unreliable. Consider adding a more capable model.`;
  logger.warn('[SmartRouter] %s', warning);

  return {
    providerId: best.providerId,
    modelId: best.modelId,
    quality: best.quality,
    costPer1M: best.costPer1M,
    meetsFloor: false,
    qualityWarning: warning,
  };
}

// ─── Tier Config Builder (backward compatible) ──────────────────────────────────

/**
 * Build tier configuration from available providers.
 * Uses quality scores instead of hardcoded model lists.
 */
export function buildTierConfig(providers: ProviderRepository): TierConfig {
  const config: TierConfig = { cheap: null, standard: null, premium: null };
  const inventory = buildModelInventory(providers);

  // Sort by quality ascending
  const sorted = [...inventory].sort((a, b) => a.quality - b.quality);

  for (const model of sorted) {
    const tier = qualityToTier(model.quality);
    if (!config[tier]) {
      // For each tier, pick the cheapest model in that quality band
      config[tier] = { providerId: model.providerId, modelId: model.modelId };
    }
  }

  // If we have premium but not standard, the premium model can fill standard
  // If we have cheap but not standard, the cheap model can fill standard
  if (!config.standard) {
    config.standard = config.premium ?? config.cheap;
  }

  return config;
}

// ─── Route To Model ─────────────────────────────────────────────────────────────

/**
 * Route a request to the best model for the task.
 * Uses quality-aware selection when possible, falls back to tier config.
 */
export function routeToModel(
  ctx: RoutingContext,
  tierConfig: TierConfig,
  fallbackProvider: string,
  fallbackModel: string,
  providers?: ProviderRepository,
): RoutingDecision {
  // If providers available, use quality-aware routing
  if (providers) {
    const { task, reason } = classifyTask(ctx);

    // Agent-level override bypasses quality routing
    if (ctx.agentTier) {
      const tierSlot = tierConfig[ctx.agentTier];
      if (tierSlot) {
        return { tier: ctx.agentTier, ...tierSlot, reason: `Agent fixed tier: ${ctx.agentTier}` };
      }
    }

    const result = selectModelForTask(task, providers);
    if (result) {
      return {
        tier: qualityToTier(result.quality),
        providerId: result.providerId,
        modelId: result.modelId,
        reason: `${reason} → quality ${result.quality} (floor ${QUALITY_FLOORS[task]})${result.meetsFloor ? '' : ' [BELOW FLOOR]'}`,
        qualityWarning: result.qualityWarning,
      };
    }
  }

  // Fallback: tier-based routing (backward compatible)
  const { tier, reason } = classifyComplexity(ctx);

  if (ctx.agentTier && tierConfig[ctx.agentTier]) {
    return { tier: ctx.agentTier, ...tierConfig[ctx.agentTier]!, reason: `Agent fixed tier: ${ctx.agentTier}` };
  }

  if (tierConfig[tier]) {
    return { tier, ...tierConfig[tier]!, reason };
  }

  // Fallback chain
  const fallbackOrder: ModelTier[] =
    tier === 'cheap' ? ['standard', 'premium'] :
    tier === 'premium' ? ['standard', 'cheap'] :
    ['premium', 'cheap'];

  for (const fb of fallbackOrder) {
    if (tierConfig[fb]) {
      return {
        tier: fb,
        ...tierConfig[fb]!,
        reason: `${reason} (wanted ${tier}, fell back to ${fb})`,
      };
    }
  }

  return {
    tier,
    providerId: fallbackProvider,
    modelId: fallbackModel,
    reason: `${reason} (no tier models available, using agent default)`,
  };
}

// ─── System Task Routing (for internal subsystems) ──────────────────────────────

/**
 * Get the best model for a system task (compaction, extraction, etc.)
 * This is the primary API for internal subsystems.
 *
 * Returns null if no providers are available at all.
 */
export function getSystemModel(
  task: SystemTask,
  providers: ProviderRepository,
): QualityRoutingResult | null {
  return selectModelForTask(task, providers);
}
