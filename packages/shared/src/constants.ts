// HiveClaw constants (formerly SuperClaw Pure)
export const HIVECLAW_HOME = '~/.hiveclaw';
export const HIVECLAW_DB = 'hiveclaw.db';

// Legacy aliases — backward compat during migration
export const SUPERCLAW_HOME = HIVECLAW_HOME;
export const SUPERCLAW_DB = HIVECLAW_DB;
export const DEFAULT_SERVER_PORT = 4070;
export const DEFAULT_WEB_PORT = 3200;
export const OPENCLAW_WS_URL = 'ws://127.0.0.1:18789';

// Agent limits
export const MAX_SQUAD_SIZE = 8;
export const MAX_DEBATE_ROUNDS = 3;
export const MAX_PARALLEL_AGENTS = 4;

// Status
export const AGENT_STATUS = {
  ACTIVE: 'active',
  IDLE: 'idle',
  BUSY: 'busy',
  ERROR: 'error',
  OFFLINE: 'offline',
} as const;

export const SPRINT_STATUS = {
  PLANNING: 'planning',
  ACTIVE: 'active',
  REVIEW: 'review',
  DONE: 'done',
} as const;

export const TASK_STATUS = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  REVIEW: 'review',
  DONE: 'done',
} as const;

export const DEBATE_STATUS = {
  ACTIVE: 'active',
  RESOLVED: 'resolved',
  ESCALATED: 'escalated',
} as const;

export const DEBATE_POSITION = {
  PROPOSE: 'propose',
  COUNTER: 'counter',
  ARGUE: 'argue',
  CONCEDE: 'concede',
} as const;
