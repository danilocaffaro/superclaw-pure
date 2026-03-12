'use client';

import type { AgentRow } from './types';

const STATUS_COLOR: Record<AgentRow['status'], string> = {
  active: 'var(--green)',
  idle: 'var(--text-muted)',
  busy: 'var(--yellow)',
  error: 'var(--coral)',
  offline: 'var(--text-secondary)',
};

const STATUS_LABEL: Record<AgentRow['status'], string> = {
  active: 'Active',
  idle: 'Idle',
  busy: 'Busy',
  error: 'Error',
  offline: 'Offline',
};

export function StatusBadge({ status }: { status: AgentRow['status'] }) {
  const color = STATUS_COLOR[status] ?? 'var(--text-muted)';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 11,
        fontWeight: 600,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        textTransform: 'capitalize',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          boxShadow: status === 'active' ? `0 0 6px ${color}` : 'none',
          flexShrink: 0,
        }}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}
