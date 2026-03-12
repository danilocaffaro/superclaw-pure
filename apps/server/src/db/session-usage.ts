// ============================================================
// Session Usage Tracking — Cost & token tracking per session
// ============================================================

import type Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

// ─── Public Interfaces ────────────────────────────────────────────────────────

export interface UsageRecord {
  id: string;
  session_id: string;
  provider: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  created_at: string;
}

export interface UsageSummary {
  totalTokensIn: number;
  totalTokensOut: number;
  totalTokens: number;
  totalCost: number;
  records: UsageRecord[];
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class SessionUsageRepository {
  constructor(private db: Database.Database) {}

  /**
   * Record a usage entry for a session (e.g. after a chat completion).
   */
  record(
    sessionId: string,
    provider: string,
    model: string,
    tokensIn: number,
    tokensOut: number,
    costUsd: number,
  ): UsageRecord {
    const id = randomUUID();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO session_usage (id, session_id, provider, model, tokens_in, tokens_out, cost_usd, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, sessionId, provider, model, tokensIn, tokensOut, costUsd, now);

    return {
      id,
      session_id: sessionId,
      provider,
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: costUsd,
      created_at: now,
    };
  }

  /**
   * Get all usage records for a session with computed totals.
   */
  getBySession(sessionId: string): UsageSummary {
    const rows = this.db.prepare(`
      SELECT * FROM session_usage
      WHERE session_id = ?
      ORDER BY created_at ASC
    `).all(sessionId) as UsageRecord[];

    return this.buildSummary(rows);
  }

  /**
   * Get all usage records for an agent (across all their sessions).
   */
  getByAgent(agentId: string): UsageSummary {
    const rows = this.db.prepare(`
      SELECT su.* FROM session_usage su
      JOIN sessions s ON s.id = su.session_id
      WHERE s.agent_id = ?
      ORDER BY su.created_at ASC
    `).all(agentId) as UsageRecord[];

    return this.buildSummary(rows);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private buildSummary(records: UsageRecord[]): UsageSummary {
    let totalTokensIn = 0;
    let totalTokensOut = 0;
    let totalCost = 0;

    for (const r of records) {
      totalTokensIn += r.tokens_in;
      totalTokensOut += r.tokens_out;
      totalCost += r.cost_usd;
    }

    return {
      totalTokensIn,
      totalTokensOut,
      totalTokens: totalTokensIn + totalTokensOut,
      totalCost: Math.round(totalCost * 1_000_000) / 1_000_000, // avoid floating-point drift
      records,
    };
  }
}
