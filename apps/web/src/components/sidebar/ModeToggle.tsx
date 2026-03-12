'use client';

import { useUIStore } from '@/stores/ui-store';

export function ModeToggle() {
  const { interfaceMode, toggleInterfaceMode } = useUIStore();
  return (
    <div
      style={{
        padding: '8px 12px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
        {interfaceMode === 'lite' ? '💬 Lite' : '⚡ Pro'}
      </span>
      <button
        onClick={toggleInterfaceMode}
        title={interfaceMode === 'lite' ? 'Switch to Pro mode' : 'Switch to Lite mode'}
        style={{
          padding: '3px 10px',
          borderRadius: 10,
          fontSize: 10,
          fontWeight: 600,
          background:
            interfaceMode === 'pro'
              ? 'var(--purple-subtle, rgba(188,140,255,0.1))'
              : 'var(--surface-hover)',
          color: interfaceMode === 'pro' ? 'var(--purple)' : 'var(--text-muted)',
          border: `1px solid ${interfaceMode === 'pro' ? 'rgba(188,140,255,0.3)' : 'var(--border)'}`,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = '0.8';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = '1';
        }}
      >
        {interfaceMode === 'lite' ? 'Go Pro' : 'Go Lite'}
      </button>
    </div>
  );
}
