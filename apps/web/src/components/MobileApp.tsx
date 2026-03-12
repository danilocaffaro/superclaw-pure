'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSessionStore, type Session } from '@/stores/session-store';
import { useUIStore } from '@/stores/ui-store';
import { useAgentStore } from '@/stores/agent-store';
import { useSquadStore, type Squad } from '@/stores/squad-store';
import ChatArea from './ChatArea';
import MobileRightPanel from './MobileRightPanel';
import { ErrorBoundary } from './ErrorBoundary';

// ─── Agent colors ───────────────────────────────────────────────────────────────

const AGENT_COLORS: Record<string, string> = {
  main: 'var(--coral)',
  adler: '#4A90D9',
  zara: '#9B59B6',
  scout: '#27AE60',
  nr: '#E67E22',
  cris: '#E91E8F',
  bella: '#E91E8F',
  forge: '#3498DB',
  blitz: '#F39C12',
  pixel: '#1ABC9C',
  hook: '#8E44AD',
  funnel: '#2980B9',
  radar: '#D35400',
};

const AGENT_EMOJI: Record<string, string> = {
  // No special emoji — use first letter of agent name
};

import { cleanAgentName } from '@/lib/agent-utils';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ContactEntry {
  agentId: string;
  name: string;
  avatarText: string;
  avatarColor: string;
  sessionId: string | null; // null = no conversation yet
  preview: string;
  time: string;
  updatedAt: number; // for sorting
}

// ─── Build Contact List ─────────────────────────────────────────────────────────

function buildContactList(
  agents: { id: string; name: string }[],
  sessions: Session[],
): ContactEntry[] {
  // Build session lookup: agent_id → session (prefer agent:X:main, then superclaw:)
  const sessionByAgent = new Map<string, Session>();
  for (const s of sessions) {
    const id = s.id ?? '';
    const agentId = s.agent_id ?? '';
    if (!agentId) continue;

    const existing = sessionByAgent.get(agentId);
    // Prefer the most recent session for this agent
    if (!existing || new Date(s.updated_at).getTime() > new Date(existing.updated_at).getTime()) {
      sessionByAgent.set(agentId, s);
    }
  }

  // Map agents to contact entries
  const contacts: ContactEntry[] = agents.map((agent) => {
    const session = sessionByAgent.get(agent.id);
    const name = cleanAgentName(agent.id, agent.name || '');
    const avatarText = AGENT_EMOJI[agent.id] ?? name.charAt(0).toUpperCase();
    const avatarColor = AGENT_COLORS[agent.id] ?? '#607D8B';

    return {
      agentId: agent.id,
      name,
      avatarText,
      avatarColor,
      sessionId: session?.id ?? null,
      preview: session?.last_message?.slice(0, 80) ?? '',
      time: session?.updated_at
        ? new Date(session.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '',
      updatedAt: session?.updated_at ? new Date(session.updated_at).getTime() : 0,
    };
  });

  // Sort: contacts with conversations first (by recency), then alphabetical
  contacts.sort((a, b) => {
    if (a.updatedAt && !b.updatedAt) return -1;
    if (!a.updatedAt && b.updatedAt) return 1;
    if (a.updatedAt && b.updatedAt) return b.updatedAt - a.updatedAt;
    // SuperClaw (main) always first among no-conversation contacts
    if (a.agentId === 'main') return -1;
    if (b.agentId === 'main') return 1;
    return a.name.localeCompare(b.name);
  });

  return contacts;
}

// ─── Contact Item ───────────────────────────────────────────────────────────────

function ContactItem({
  entry,
  onTap,
}: {
  entry: ContactEntry;
  onTap: () => void;
}) {
  return (
    <div
      role="button"
      aria-label={`Chat with ${entry.name}`}
      onClick={onTap}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        cursor: 'pointer',
        borderBottom: '1px solid var(--border)',
        transition: 'background 100ms',
      }}
    >
      <div
        style={{
          width: 48, height: 48, borderRadius: '50%',
          background: entry.avatarColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0,
        }}
      >
        {entry.avatarText}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.name}
          </span>
          {entry.time && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', flexShrink: 0 }}>
              {entry.time}
            </span>
          )}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
          {entry.preview || (entry.sessionId ? 'Tap to continue' : 'Tap to start chatting')}
        </div>
      </div>
    </div>
  );
}

// ─── Conversations List (Home Screen) ──────────────────────────────────────────

function ConversationsList() {
  const { sessions, fetchSessions, createSession, createSquadSession, setActiveSession } = useSessionStore();
  const { agents, fetchAgents } = useAgentStore();
  const { squads, fetchSquads } = useSquadStore();
  const { setMobileScreen, setSettingsOpen } = useUIStore();

  useEffect(() => {
    fetchSessions({ preview: true });
    fetchAgents();
    fetchSquads();
  }, [fetchSessions, fetchAgents, fetchSquads]);

  const contacts = useMemo(() => buildContactList(agents, sessions), [agents, sessions]);

  const handleTap = useCallback(async (entry: ContactEntry) => {
    if (entry.sessionId) {
      setActiveSession(entry.sessionId);
      setMobileScreen('chat');
    } else {
      const session = await createSession({ title: 'New Chat', agent_id: entry.agentId });
      if (session) {
        setMobileScreen('chat');
      }
    }
  }, [setActiveSession, setMobileScreen, createSession]);

  const handleSquadTap = useCallback(async (squad: Squad) => {
    await createSquadSession(squad.id, `Squad: ${squad.name}`);
    setMobileScreen('chat');
  }, [createSquadSession, setMobileScreen]);

  const handleNewChat = useCallback(async () => {
    const session = await createSession({ title: 'New Chat', agent_id: 'main' });
    if (session) {
      setMobileScreen('chat');
    }
  }, [createSession, setMobileScreen]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)', background: 'var(--surface)',
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          SuperClaw
        </h1>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: 4, color: 'var(--text-secondary)' }}
          >
            ⚙️
          </button>
          <button
            aria-label="New chat"
            onClick={handleNewChat}
            style={{
              background: 'var(--coral)', border: 'none', borderRadius: '50%',
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff', fontSize: 20, fontWeight: 700,
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* Contact list */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {/* Squads section */}
        {squads.length > 0 && (
          <>
            <div style={{
              padding: '12px 16px 8px',
              fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              color: 'var(--text-muted)', letterSpacing: '0.5px',
            }}>
              Squads
            </div>
            {squads.map((squad) => {
              const memberEmojis = (squad.agentIds ?? []).slice(0, 3).map((aid) => {
                const a = agents.find((ag) => ag.id === aid);
                return a?.emoji ?? '🤖';
              });
              return (
                <div
                  key={squad.id}
                  role="button"
                  aria-label={`Open squad ${squad.name}`}
                  onClick={() => handleSquadTap(squad)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', cursor: 'pointer',
                    borderBottom: '1px solid var(--border)', transition: 'background 100ms',
                  }}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--coral), #9B59B6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: 22, flexShrink: 0,
                  }}>
                    {squad.emoji || '👥'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text)' }}>
                      {squad.name}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {memberEmojis.join(' ')} · {(squad.agentIds ?? []).length} agents · {squad.routingStrategy ?? 'sequential'}
                    </div>
                  </div>
                  <div style={{ fontSize: 20, color: 'var(--text-muted)' }}>›</div>
                </div>
              );
            })}
            <div style={{
              padding: '12px 16px 8px',
              fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              color: 'var(--text-muted)', letterSpacing: '0.5px',
            }}>
              Agents
            </div>
          </>
        )}

        {contacts.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 16, padding: 32,
            color: 'var(--text-secondary)',
          }}>
            <div style={{ fontSize: 64 }}>✨</div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
              Welcome to SuperClaw
            </h2>
            <p style={{ fontSize: 15, textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
              Your personal AI assistant. Loading agents...
            </p>
          </div>
        ) : (
          contacts.map((entry) => (
            <ContactItem
              key={entry.agentId}
              entry={entry}
              onTap={() => handleTap(entry)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Mobile Chat View ──────────────────────────────────────────────────────────

function MobileChatView() {
  const { setMobileScreen } = useUIStore();
  const { activeSessionId, sessions } = useSessionStore();
  const { agents } = useAgentStore();
  const { squads } = useSquadStore();
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);

  const session = sessions.find((s) => s.id === activeSessionId);
  const isSquad = session?.mode === 'squad' && session?.squad_id;
  const squad = isSquad ? squads.find((sq) => sq.id === session.squad_id) : null;

  const agentId = session?.agent_id ?? 'main';
  const agent = agents.find((a) => a.id === agentId);
  const agentName = isSquad
    ? (squad?.name ?? 'Squad')
    : cleanAgentName(agentId, agent?.name || '');
  const avatarText = isSquad
    ? (squad?.emoji ?? '👥')
    : (AGENT_EMOJI[agentId] ?? agentName.charAt(0).toUpperCase());
  const avatarColor = isSquad
    ? 'linear-gradient(135deg, var(--coral), #9B59B6)'
    : (AGENT_COLORS[agentId] ?? 'var(--coral)');
  const subtitle = isSquad
    ? `${(squad?.agentIds ?? []).length} agents · ${squad?.routingStrategy ?? 'sequential'}`
    : 'Online';

  const handleBack = useCallback(() => {
    setMobileScreen('conversations');
  }, [setMobileScreen]);

  // B055: Swipe left to open right panel
  const handleChatTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
  }, []);

  const handleChatTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
    // Swipe left (negative dx) with minimal vertical movement → open panel
    if (dx < -80 && dy < 50 && !rightPanelOpen) {
      setRightPanelOpen(true);
    }
  }, [touchStartX, touchStartY, rightPanelOpen]);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)',
    }}>
      {/* Chat header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 8px 8px 4px',
        paddingTop: 'calc(8px + env(safe-area-inset-top))',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)', zIndex: 10,
      }}>
        <button
          aria-label="Back to conversations"
          onClick={handleBack}
          style={{
            background: 'none', border: 'none', fontSize: 24, cursor: 'pointer',
            padding: '4px 8px', color: 'var(--coral)', display: 'flex', alignItems: 'center',
          }}
        >
          ←
        </button>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', background: avatarColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: isSquad ? 18 : 14, flexShrink: 0,
        }}>
          {avatarText}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {agentName}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {subtitle}
          </div>
        </div>
        {/* B055: Right panel toggle button */}
        <button
          aria-label="Open chat info"
          onClick={() => setRightPanelOpen(true)}
          style={{
            background: 'none', border: 'none', fontSize: 18, cursor: 'pointer',
            padding: '4px 8px', color: 'var(--text-secondary)',
          }}
        >
          ℹ️
        </button>
      </div>

      {/* Chat area with swipe detection */}
      <div
        style={{ flex: 1, overflow: 'hidden' }}
        onTouchStart={handleChatTouchStart}
        onTouchEnd={handleChatTouchEnd}
      >
        <ErrorBoundary>
          <ChatArea hideHeader />
        </ErrorBoundary>
      </div>

      {/* B055: Mobile right panel (slide from right) */}
      <MobileRightPanel
        open={rightPanelOpen}
        onClose={() => setRightPanelOpen(false)}
      />
    </div>
  );
}

// ─── MobileApp (Stack Navigation) ─────────────────────────────────────────────

export default function MobileApp() {
  const { mobileScreen } = useUIStore();

  if (mobileScreen === 'chat') {
    return <MobileChatView />;
  }

  return <ConversationsList />;
}
