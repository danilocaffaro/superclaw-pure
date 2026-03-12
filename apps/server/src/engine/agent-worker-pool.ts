// ============================================================
// Agent Worker Pool — Manages all agent workers
// ============================================================

import { EventEmitter } from 'events';
import { AgentWorker, type AgentWorkerConfig, type AgentState } from './agent-worker.js';

// ─── Pool Status ──────────────────────────────────────────────────────────────

export interface PoolStatus {
  total: number;
  byState: Record<AgentState, number>;
  agents: ReturnType<AgentWorker['toJSON']>[];
}

// ─── Agent Worker Pool ────────────────────────────────────────────────────────

export class AgentWorkerPool extends EventEmitter {
  private workers = new Map<string, AgentWorker>();

  /**
   * Spawn a new agent worker. If one with the same id already exists, return it.
   */
  spawn(config: AgentWorkerConfig): AgentWorker {
    if (this.workers.has(config.id)) {
      return this.workers.get(config.id)!;
    }
    const worker = new AgentWorker(config);
    this.workers.set(config.id, worker);

    worker.on('stateChange', (data) => this.emit('agentStateChange', data));
    worker.on('error', (err) => this.emit('agentError', { agentId: config.id, error: err }));

    this.emit('agentSpawned', { agentId: config.id });
    return worker;
  }

  /**
   * Stop and remove an agent worker by id.
   */
  kill(agentId: string): boolean {
    const worker = this.workers.get(agentId);
    if (!worker) return false;
    worker.stop();
    worker.removeAllListeners();
    this.workers.delete(agentId);
    this.emit('agentKilled', { agentId });
    return true;
  }

  /**
   * Get an agent worker by id (returns undefined if not found).
   */
  get(agentId: string): AgentWorker | undefined {
    return this.workers.get(agentId);
  }

  /**
   * Get an existing worker or spawn a new one.
   */
  getOrSpawn(config: AgentWorkerConfig): AgentWorker {
    return this.workers.get(config.id) ?? this.spawn(config);
  }

  /**
   * List all active agent workers.
   */
  list(): AgentWorker[] {
    return Array.from(this.workers.values());
  }

  /**
   * Get pool status: total count, counts by state, and agent details.
   */
  status(): PoolStatus {
    const agents = this.list().map(w => w.toJSON());
    const byState: Record<string, number> = {};
    for (const a of agents) {
      byState[a.state] = (byState[a.state] ?? 0) + 1;
    }
    return {
      total: agents.length,
      byState: byState as Record<AgentState, number>,
      agents,
    };
  }

  /**
   * Kill all workers in the pool.
   */
  killAll(): void {
    for (const [id] of this.workers) {
      this.kill(id);
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _pool: AgentWorkerPool | null = null;

export function getWorkerPool(): AgentWorkerPool {
  if (!_pool) _pool = new AgentWorkerPool();
  return _pool;
}
