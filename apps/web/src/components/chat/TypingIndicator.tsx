'use client';

import React from 'react';
import { useSessionStore } from '@/stores/session-store';
import { useAgentStore } from '@/stores/agent-store';

// ─── Typing Indicator ───────────────────────────────────────────────────────────

export function TypingIndicator() {
  const activeSession = useSessionStore((s) => s.sessions.find((sess) => sess.id === s.activeSessionId));
  const agents = useAgentStore((s) => s.agents);
  const agent = agents.find((a) => a.id === activeSession?.agent_id);
  const emoji = agent?.emoji ?? '✨';
  const name = agent?.name ?? 'Assistant';

  return (
    <div aria-live="polite" aria-label="Assistant is typing" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0' }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background: 'var(--coral-subtle)',
        border: '1px solid rgba(255,107,107,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14,
      }}>
        {emoji}
      </div>
      <div style={{
        padding: '10px 16px', borderRadius: '14px 14px 14px 4px',
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--coral)',
              animation: `bounce 1.2s ${i * 0.2}s infinite`,
              display: 'inline-block', opacity: 0.6,
            }} />
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {name} is thinking…
        </span>
      </div>
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}`}</style>
    </div>
  );
}

