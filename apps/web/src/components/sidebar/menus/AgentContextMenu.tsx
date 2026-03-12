'use client';

import type { Agent } from '@/stores/agent-store';

interface AgentContextMenuProps {
  x: number;
  y: number;
  agent: Agent;
  onClose: () => void;
  onEdit: () => void;
  onChat: () => void;
  onDelete: () => void;
}

export function AgentContextMenu({ x, y, agent, onClose, onEdit, onChat, onDelete }: AgentContextMenuProps) {
  const menuItems: Array<{ label: string; icon: string; action: () => void; danger?: boolean }> = [
    { label: 'Edit', icon: '✏️', action: onEdit },
    { label: 'Chat', icon: '💬', action: onChat },
    { label: 'Delete', icon: '🗑️', action: () => {
      if (confirm(`Delete agent "${agent.name}"?`)) onDelete();
    }, danger: true },
  ];

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 999 }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <div
        style={{
          position: 'fixed',
          left: x,
          top: y,
          zIndex: 1000,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '4px 0',
          minWidth: 140,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}
      >
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={(e) => {
              e.stopPropagation();
              item.action();
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '6px 14px',
              fontSize: 13,
              color: item.danger ? 'var(--coral)' : 'var(--text)',
              transition: 'background 100ms',
              textAlign: 'left',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            <span style={{ fontSize: 12 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
