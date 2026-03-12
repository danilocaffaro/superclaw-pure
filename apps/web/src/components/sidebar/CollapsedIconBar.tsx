'use client';

import { useSessionStore } from '@/stores/session-store';

export function CollapsedIconBar() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 4px' }}>
      {sessions.slice(0, 8).map((s) => (
        <button
          key={s.id}
          title={s.title || 'New Chat'}
          onClick={() => setActiveSession(s.id)}
          style={{
            width: 40,
            height: 40,
            margin: '0 auto 4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--radius-md)',
            background:
              s.id === activeSessionId ? 'var(--coral-subtle)' : 'transparent',
            border: `1px solid ${s.id === activeSessionId ? 'rgba(255,107,107,0.3)' : 'transparent'}`,
            fontSize: 16,
            transition: 'all 150ms',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            if (s.id !== activeSessionId)
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hover)';
          }}
          onMouseLeave={(e) => {
            if (s.id !== activeSessionId)
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          {s.mode === 'squad' ? '👥' : '💬'}
        </button>
      ))}
    </div>
  );
}
