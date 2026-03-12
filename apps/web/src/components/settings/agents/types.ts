// Shared types for AgentsTab sub-components

export interface WorkerAgentStatus {
  agentId: string;
  name: string;
  emoji: string | undefined;
  state: 'idle' | 'thinking' | 'tool_use' | 'responding' | 'waiting' | 'error' | 'offline';
  lastActivity: number;
  stats: { messages: number; tokens: number };
}

export interface PoolStatusData {
  total: number;
  byState: Record<string, number>;
  agents: WorkerAgentStatus[];
  event?: unknown;
}

export interface AgentRow {
  id: string;
  name: string;
  emoji: string;
  role: string;
  type: 'super' | 'specialist';
  systemPrompt: string;
  skills: string[];
  modelPreference: string;
  providerPreference: string;
  temperature: number;
  maxTokens: number;
  status: 'active' | 'idle' | 'busy' | 'error' | 'offline';
  color: string;
  createdAt: string;
  updatedAt: string;
  source?: 'openclaw' | 'superclaw';
  gatewayId?: string;
}

export const WORKER_STATE_DOT: Record<string, { color: string; label: string; glow: boolean }> = {
  idle: { color: 'var(--green)', label: 'Idle', glow: false },
  thinking: { color: 'var(--yellow)', label: 'Thinking', glow: true },
  tool_use: { color: 'var(--yellow)', label: 'Using tool', glow: true },
  responding: { color: 'var(--blue, #58A6FF)', label: 'Responding', glow: true },
  waiting: { color: 'var(--yellow)', label: 'Waiting', glow: false },
  error: { color: 'var(--coral)', label: 'Error', glow: false },
  offline: { color: 'var(--text-secondary)', label: 'Offline', glow: false },
};
