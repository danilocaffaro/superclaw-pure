'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { useAgentStore } from '@/stores/agent-store';
import { useSquadStore } from '@/stores/squad-store';
import { cleanAgentName } from '@/lib/agent-utils';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface MobileRightPanelProps {
  open: boolean;
  onClose: () => void;
}

// ─── Section Component ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
        color: 'var(--text-muted)', marginBottom: 8, padding: '0 16px',
      }}>
        {title}
      </div>
      <div style={{ padding: '0 16px' }}>{children}</div>
    </div>
  );
}

// ─── Member Chip ────────────────────────────────────────────────────────────────

function MemberChip({ name, emoji, role }: { name: string; emoji: string; role?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 22 }}>{emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{name}</div>
        {role && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{role}</div>}
      </div>
    </div>
  );
}

// ─── Info Row ───────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '6px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────────────────────

export default function MobileRightPanel({ open, onClose }: MobileRightPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const { activeSessionId, sessions } = useSessionStore();
  const { agents } = useAgentStore();
  const { squads } = useSquadStore();
  const [touchStartX, setTouchStartX] = useState(0);

  const session = sessions.find((s) => s.id === activeSessionId);
  const isSquad = session?.mode === 'squad' && session?.squad_id;
  const squad = isSquad ? squads.find((sq) => sq.id === session?.squad_id) : null;
  const agentId = session?.agent_id ?? 'main';
  const agent = agents.find((a) => a.id === agentId);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Swipe left to close
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (dx > 80) onClose(); // swipe right = close (panel slides right)
  }, [touchStartX, onClose]);

  if (!session) return null;

  const messages = []; // could load message stats if needed

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(0,0,0,0.5)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 250ms ease',
        }}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: '80vw', maxWidth: 320, zIndex: 1000,
          background: 'var(--surface)', borderLeft: '1px solid var(--border)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 300ms cubic-bezier(0.2, 0.9, 0.3, 1)',
          display: 'flex', flexDirection: 'column',
          paddingTop: 'env(safe-area-inset-top)',
          overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
        }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            {isSquad ? 'Squad Info' : 'Chat Info'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', fontSize: 20, cursor: 'pointer',
              color: 'var(--text-secondary)', padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, paddingTop: 16 }}>
          {/* Chat/Squad info */}
          {isSquad && squad ? (
            <>
              <Section title="Squad">
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 40 }}>{squad.emoji ?? '👥'}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>
                    {squad.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {squad.routingStrategy} · {squad.agentIds?.length ?? 0} members
                  </div>
                </div>
              </Section>

              <Section title="Members">
                {(squad.agentIds ?? []).map((aid) => {
                  const a = agents.find((ag) => ag.id === aid);
                  return (
                    <MemberChip
                      key={aid}
                      name={cleanAgentName(aid, a?.name ?? aid)}
                      emoji={a?.emoji ?? '🤖'}
                      role={a?.role}
                    />
                  );
                })}
              </Section>
            </>
          ) : (
            <Section title="Agent">
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 40 }}>{agent?.emoji ?? '🤖'}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>
                  {cleanAgentName(agentId, agent?.name ?? agentId)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {agent?.role ?? 'Agent'}
                </div>
              </div>
            </Section>
          )}

          {/* Session info */}
          <Section title="Session">
            <InfoRow label="ID" value={session.id?.slice(0, 8) ?? '—'} />
            <InfoRow label="Created" value={session.created_at ? new Date(session.created_at).toLocaleDateString() : '—'} />
            <InfoRow label="Mode" value={isSquad ? 'Squad' : 'DM'} />
            {session.agent_id && <InfoRow label="Agent" value={session.agent_id} />}
          </Section>

          {/* Quick actions */}
          <Section title="Actions">
            <button style={{
              width: '100%', padding: '10px 0', background: 'var(--surface-hover)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
              marginBottom: 8,
            }}>
              📋 Export Chat
            </button>
            <button style={{
              width: '100%', padding: '10px 0', background: 'var(--surface-hover)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              color: '#f85149', fontSize: 13, cursor: 'pointer',
            }}>
              🗑️ Clear History
            </button>
          </Section>
        </div>
      </div>
    </>
  );
}
