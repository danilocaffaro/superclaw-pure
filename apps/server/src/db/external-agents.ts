/**
 * db/external-agents.ts — External Agent Registry
 *
 * Manages agents that live outside SuperClaw Pure (e.g. OpenClaw agents,
 * custom bots, third-party AI services). These agents participate in
 * squad chats via webhook-based communication.
 *
 * Two tiers:
 *   Tier 1 (Lightweight) — agent receives contextual messages, responds plain text
 *   Tier 2 (Enhanced) — agent installs Protocol Pack, gains @mention, tasks, history access
 */

import type Database from 'better-sqlite3';
import { logger } from '../lib/logger.js';
import crypto from 'node:crypto';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ExternalAgentTier = 'lightweight' | 'enhanced';
export type ExternalAgentStatus = 'active' | 'inactive' | 'error';

export interface ExternalAgent {
  id: string;
  name: string;
  emoji: string;
  description: string;
  tier: ExternalAgentTier;
  status: ExternalAgentStatus;

  /** Webhook URL to send messages to this agent */
  webhookUrl: string;

  /** Auth token this agent must send when calling back */
  inboundToken: string;

  /** Auth token SuperClaw sends in webhook requests (Bearer) */
  outboundToken: string;

  /** Optional: role in squads (for ARCHER v2 routing) */
  role: string;

  /** Optional: capabilities declared by the agent */
  capabilities: string[];

  /** Whether the Protocol Pack was installed (Tier 2) */
  protocolPackInstalled: boolean;

  /** Last successful interaction timestamp */
  lastSeenAt: string | null;

  /** Consecutive failure count (for circuit breaker) */
  failureCount: number;

  createdAt: string;
  updatedAt: string;
}

export interface ExternalAgentCreateInput {
  name: string;
  emoji?: string;
  description?: string;
  webhookUrl: string;
  role?: string;
  tier?: ExternalAgentTier;
  capabilities?: string[];
}

interface ExternalAgentRow {
  id: string;
  name: string;
  emoji: string;
  description: string;
  tier: string;
  status: string;
  webhook_url: string;
  inbound_token: string;
  outbound_token: string;
  role: string;
  capabilities: string;
  protocol_pack_installed: number;
  last_seen_at: string | null;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

// ─── Schema ────────────────────────────────────────────────────────────────────

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS external_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '🤖',
  description TEXT DEFAULT '',
  tier TEXT DEFAULT 'lightweight' CHECK(tier IN ('lightweight', 'enhanced')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'error')),
  webhook_url TEXT NOT NULL,
  inbound_token TEXT NOT NULL,
  outbound_token TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  capabilities TEXT DEFAULT '[]',
  protocol_pack_installed INTEGER DEFAULT 0,
  last_seen_at DATETIME,
  failure_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function rowToAgent(row: ExternalAgentRow): ExternalAgent {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    description: row.description,
    tier: row.tier as ExternalAgentTier,
    status: row.status as ExternalAgentStatus,
    webhookUrl: row.webhook_url,
    inboundToken: row.inbound_token,
    outboundToken: row.outbound_token,
    role: row.role,
    capabilities: JSON.parse(row.capabilities || '[]'),
    protocolPackInstalled: row.protocol_pack_installed === 1,
    lastSeenAt: row.last_seen_at,
    failureCount: row.failure_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Repository ────────────────────────────────────────────────────────────────

export class ExternalAgentRepository {
  constructor(private db: Database.Database) {
    this.db.exec(CREATE_TABLE);
  }

  list(): ExternalAgent[] {
    const rows = this.db.prepare('SELECT * FROM external_agents ORDER BY created_at DESC').all() as ExternalAgentRow[];
    return rows.map(rowToAgent);
  }

  getById(id: string): ExternalAgent | null {
    const row = this.db.prepare('SELECT * FROM external_agents WHERE id = ?').get(id) as ExternalAgentRow | undefined;
    return row ? rowToAgent(row) : null;
  }

  getByInboundToken(token: string): ExternalAgent | null {
    const row = this.db.prepare('SELECT * FROM external_agents WHERE inbound_token = ?').get(token) as ExternalAgentRow | undefined;
    return row ? rowToAgent(row) : null;
  }

  create(input: ExternalAgentCreateInput): ExternalAgent {
    const id = crypto.randomUUID();
    const inboundToken = generateToken();
    const outboundToken = generateToken();

    this.db.prepare(`
      INSERT INTO external_agents (id, name, emoji, description, tier, webhook_url, inbound_token, outbound_token, role, capabilities)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.name,
      input.emoji ?? '🤖',
      input.description ?? '',
      input.tier ?? 'lightweight',
      input.webhookUrl,
      inboundToken,
      outboundToken,
      input.role ?? 'member',
      JSON.stringify(input.capabilities ?? []),
    );

    logger.info('[ExternalAgent] Created %s (%s) tier=%s', input.name, id, input.tier ?? 'lightweight');
    return this.getById(id)!;
  }

  update(id: string, fields: Partial<ExternalAgentCreateInput & { status: ExternalAgentStatus; tier: ExternalAgentTier }>): ExternalAgent | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (fields.name !== undefined) { updates.push('name = ?'); values.push(fields.name); }
    if (fields.emoji !== undefined) { updates.push('emoji = ?'); values.push(fields.emoji); }
    if (fields.description !== undefined) { updates.push('description = ?'); values.push(fields.description); }
    if (fields.webhookUrl !== undefined) { updates.push('webhook_url = ?'); values.push(fields.webhookUrl); }
    if (fields.role !== undefined) { updates.push('role = ?'); values.push(fields.role); }
    if (fields.status !== undefined) { updates.push('status = ?'); values.push(fields.status); }
    if (fields.tier !== undefined) { updates.push('tier = ?'); values.push(fields.tier); }
    if (fields.capabilities !== undefined) { updates.push('capabilities = ?'); values.push(JSON.stringify(fields.capabilities)); }

    if (updates.length === 0) return existing;

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    this.db.prepare(`UPDATE external_agents SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM external_agents WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /** Mark agent as seen (reset failure count) */
  markSeen(id: string): void {
    this.db.prepare('UPDATE external_agents SET last_seen_at = CURRENT_TIMESTAMP, failure_count = 0, status = ? WHERE id = ?').run('active', id);
  }

  /** Increment failure count; set status to 'error' after 3 consecutive failures */
  recordFailure(id: string): void {
    this.db.prepare('UPDATE external_agents SET failure_count = failure_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    const agent = this.getById(id);
    if (agent && agent.failureCount >= 3) {
      this.db.prepare('UPDATE external_agents SET status = ? WHERE id = ?').run('error', id);
      logger.warn('[ExternalAgent] %s circuit breaker OPEN after %d failures', agent.name, agent.failureCount);
    }
  }

  /** Upgrade to Tier 2 (protocol pack installed) */
  upgradeToTier2(id: string): ExternalAgent | null {
    this.db.prepare('UPDATE external_agents SET tier = ?, protocol_pack_installed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('enhanced', id);
    return this.getById(id);
  }
}
