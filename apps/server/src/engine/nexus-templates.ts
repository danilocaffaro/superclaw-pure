// ============================================================
// NEXUS v3 — Intent Detection & Template Injector
// ============================================================
//
// Detects user intent (planning, sprint, review, retro, hotfix)
// and injects the appropriate NEXUS v3 phase template into the
// squad context, so agents know what mode the session is in.

// ─── Intent Patterns ──────────────────────────────────────────────────────────

const INTENTS: Array<{ name: string; patterns: RegExp[]; phase: string }> = [
  {
    name: 'planning',
    patterns: [
      /\b(planning|planing|plan|sprint plan|sprint\s*\d|próximo sprint|próxima sprint|planejamento)\b/i,
      /\bwhat (should|shall) we (build|do|work on|prioritize|focus)\b/i,
      /\b(backlog|roadmap|features?|stories|tasks?)\b.*\b(next|próximo|this week|essa semana)\b/i,
    ],
    phase: 'PLAN',
  },
  {
    name: 'execution',
    patterns: [
      /\b(implement|implementa|build|desenvolve|code|codifica|create|cria|add|adiciona)\b/i,
      /\b\[CLAIM\]\b/i,
      /\b(working on|trabalhando em|starting|começando)\b/i,
    ],
    phase: 'EXECUTE',
  },
  {
    name: 'review',
    patterns: [
      /\b(review|revisar|revisão|code review|PR|pull request|check|verificar)\b/i,
      /\b\[QA-PASS\]|\[QA-FAIL\]\b/i,
    ],
    phase: 'QA',
  },
  {
    name: 'retro',
    patterns: [
      /\b(retro|retrospective|retrospectiva|what went well|o que deu certo|what didn'?t|melhorar|improve)\b/i,
      /\b(post.mortem|lessons learned|lições aprendidas)\b/i,
    ],
    phase: 'CLOSE',
  },
  {
    name: 'hotfix',
    patterns: [
      /\b(hotfix|hot.fix|urgent|urgente|broken|quebrado|down|caiu|production|prod|emergenc)\b/i,
      /\b\[HOTFIX\]\b/i,
    ],
    phase: 'HOTFIX',
  },
  {
    name: 'consensus',
    patterns: [
      /\b(decis|decidir|consensus|consenso|agecon|vote|votar|discuss|discutir|opinião|opinion)/i,
      /\bwhat do (you|everyone|all|y'all)\b.*\bthink\b/i,
      /\b(agree|disagree|concordam|discordam)\b/i,
    ],
    phase: 'AGECON',
  },
];

// ─── Phase Templates ──────────────────────────────────────────────────────────

const PHASE_TEMPLATES: Record<string, string> = {
  PLAN: `[NEXUS v3 — PLAN Phase]
The team is in PLANNING mode. Focus on:
- Understanding the user's demand (Fase 1: UNDERSTAND)
- Breaking work into Small Batches (tasks ≤ 2h each)
- Prioritizing (P0 > P1 > P2)
- Identifying dependencies and risks
- Setting acceptance criteria per task
Output: concrete action items with clear owner and priority.
Use [CLAIM] #XX to claim a task when you're ready to work on it.`,

  EXECUTE: `[NEXUS v3 — EXECUTE Phase]
The team is in EXECUTION mode. Follow these rules:
- One agent per task (no parallel work on same code)
- Use [CLAIM] #XX before starting a task
- Use [UPDATE] #XX — X% for progress updates
- Use [BLOCKED] #XX — reason if stuck
- Open a PR — do NOT push directly to main
- QA review is mandatory before merge`,

  QA: `[NEXUS v3 — QA Phase]
The team is in REVIEW/QA mode. Scout leads. Review covers:
- Code quality: clean, legible, no code smells
- Functionality: happy path + edge cases + error handling
- UX: client-ready? would the end user understand this?
- Acceptance criteria: all met?
Output: [QA-PASS] or [QA-FAIL] with specific feedback.`,

  CLOSE: `[NEXUS v3 — CLOSE/RETRO Phase]
The team is in RETROSPECTIVE mode. Be honest and constructive:
- What went well? (celebrate wins)
- What didn't? (no blame, focus on process)
- What to improve next sprint?
- Action items for improvement
PO validates acceptance criteria and closes sprint.`,

  HOTFIX: `[NEXUS v3 — HOTFIX Mode 🚨]
PRODUCTION ISSUE. Emergency protocol active:
- PO coordinates. ONE developer implements (no parallel code changes)
- Diagnose fast, fix focused, test minimal but real
- Push directly to main is authorized by PO
- QA validates post-deploy (does not block)
- Post-mortem in 24h is MANDATORY
No discussions — action only.`,

  AGECON: `[NEXUS v3 + AGECON — Consensus Mode]
The team is building consensus. AGECON protocol:
1. PROPOSE: Initiator states position + evidence
2. ROUND: Each agent gives input (ECHO-FREE, ROLE-GATE)
3. CONSOLIDATE: Initiator summarizes + proposes consensus
4. ACK/NACK: Each agent responds ✅ ACK / ⚠️ ACK com ressalva / ❌ NACK
Max 3 rounds. If no consensus → PO decides.
Focus on evidence, not opinion. Be concise.`,
};

// ─── Exports ───────────────────────────────────────────────────────────────────

export interface IntentDetectionResult {
  intent: string | null;
  phase: string | null;
  template: string | null;
  confidence: number;
}

/**
 * Detect the user's intent and return the appropriate NEXUS v3 template.
 * Returns null template if no intent matched or confidence is low.
 */
export function detectIntent(message: string): IntentDetectionResult {
  let bestMatch: typeof INTENTS[0] | null = null;
  let bestScore = 0;

  for (const intent of INTENTS) {
    let score = 0;
    for (const pattern of intent.patterns) {
      if (pattern.test(message)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = intent;
    }
  }

  // Require at least 1 pattern match
  if (!bestMatch || bestScore === 0) {
    return { intent: null, phase: null, template: null, confidence: 0 };
  }

  const template = PHASE_TEMPLATES[bestMatch.phase] ?? null;
  const confidence = Math.min(bestScore / bestMatch.patterns.length, 1.0);

  return {
    intent: bestMatch.name,
    phase: bestMatch.phase,
    template,
    confidence,
  };
}
