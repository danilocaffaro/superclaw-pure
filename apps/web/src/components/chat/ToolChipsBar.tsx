'use client';

import React, { useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { useUIStore } from '@/stores/ui-store';

// ─── ToolChips Bar ──────────────────────────────────────────────────────────────

export function ToolChipsBar() {
  const { setSettingsOpen, setSettingsTab } = useUIStore();
  const [extendedThinking, setExtendedThinking] = useState(false);
  const [extToastVisible, setExtToastVisible] = useState(false);

  const openSettings = (tab: Parameters<typeof setSettingsTab>[0]) => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  const toggleExtended = () => {
    const next = !extendedThinking;
    setExtendedThinking(next);
    setExtToastVisible(true);
    setTimeout(() => setExtToastVisible(false), 2000);
  };

  const chips: { icon: string; label: string; color: string; count?: number; onClick: () => void }[] = [
    { icon: '⚡', label: 'Skills', color: 'var(--coral)', onClick: () => openSettings('skills') },
    { icon: '🔌', label: 'MCP', count: 5, color: 'var(--purple)', onClick: () => openSettings('mcp') },
    { icon: '🤖', label: 'Models', color: 'var(--blue)', onClick: () => openSettings('models') },
    {
      icon: '🧠', label: extendedThinking ? 'Extended ✓' : 'Extended',
      color: extendedThinking ? 'var(--green)' : 'var(--yellow)', onClick: toggleExtended,
    },
    { icon: '📄', label: 'Context', count: 3, color: 'var(--green)', onClick: () => openSettings('general') },
  ];

  return (
    <div role="toolbar" aria-label="Active tools" style={{ position: 'relative' }}>
      {/* Extended thinking toast */}
      {extToastVisible && (
        <div style={{
          position: 'absolute',
          bottom: '110%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: extendedThinking ? 'var(--green-subtle)' : 'var(--surface-hover)',
          border: `1px solid ${extendedThinking ? 'rgba(63,185,80,0.4)' : 'var(--border)'}`,
          color: extendedThinking ? 'var(--green)' : 'var(--text-secondary)',
          padding: '5px 12px',
          borderRadius: 'var(--radius-md)',
          fontSize: 12,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          zIndex: 50,
          pointerEvents: 'none',
          animation: 'fadeIn 150ms ease',
        }}>
          {extendedThinking ? '🧠 Extended thinking ON' : '🧠 Extended thinking OFF'}
        </div>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 20px', flexWrap: 'wrap', overflow: 'hidden'
      }}>
        {chips.map((chip) => (
          <button key={chip.label} onClick={chip.onClick} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 10px', borderRadius: 'var(--radius-sm)',
            background: `color-mix(in srgb, ${chip.color} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${chip.color} 25%, transparent)`,
            color: chip.color, fontSize: 12, fontWeight: 500,
            cursor: 'pointer', transition: 'all 150ms', whiteSpace: 'nowrap',
          }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `color-mix(in srgb, ${chip.color} 20%, transparent)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `color-mix(in srgb, ${chip.color} 12%, transparent)`;
            }}
          >
            <span>{chip.icon}</span>
            <span>{chip.label}</span>
            {chip.count !== undefined && (
              <span style={{
                padding: '0 5px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                background: `color-mix(in srgb, ${chip.color} 20%, transparent)`,
              }}>
                {chip.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

