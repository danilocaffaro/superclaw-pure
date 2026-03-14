'use client';

import { useState, useEffect, useCallback } from 'react';

interface ExternalAgent {
  id: string;
  name: string;
  emoji: string;
  description: string;
  tier: 'lightweight' | 'enhanced';
  status: 'active' | 'inactive' | 'error';
  webhookUrl: string;
  role: string;
  capabilities: string[];
  protocolPackInstalled: boolean;
  lastSeenAt: string | null;
  failureCount: number;
  createdAt: string;
}

/**
 * M-1: External Agents management panel.
 * List, status, test connection, rotate tokens, remove, tier upgrade.
 */
export default function ExternalAgentsPanel() {
  const [agents, setAgents] = useState<ExternalAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string } | null>>({});
  const [rotatedTokens, setRotatedTokens] = useState<Record<string, { inboundToken?: string; outboundToken?: string } | null>>({});

  const [protocolPack, setProtocolPack] = useState<Record<string, unknown> | null>(null);
  const [protocolPackAgentId, setProtocolPackAgentId] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/external-agents');
      if (!res.ok) return;
      const json = await res.json() as { data: ExternalAgent[] };
      setAgents(json.data ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchAgents(); }, [fetchAgents]);

  const testConnection = async (id: string) => {
    setTestResults((prev) => ({ ...prev, [id]: null }));
    try {
      const res = await fetch(`/api/external-agents/${id}/test`, { method: 'POST' });
      const json = await res.json() as { ok?: boolean; error?: string };
      setTestResults((prev) => ({
        ...prev,
        [id]: { ok: !!json.ok, msg: json.ok ? 'Connected ✅' : (json.error ?? 'Failed') },
      }));
      void fetchAgents(); // refresh status
    } catch (err) {
      setTestResults((prev) => ({ ...prev, [id]: { ok: false, msg: String(err) } }));
    }
  };

  const rotateTokens = async (id: string) => {
    if (!confirm('Rotate tokens? The external agent will need to update its credentials.')) return;
    try {
      const res = await fetch(`/api/external-agents/${id}/rotate-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenType: 'both' }),
      });
      const json = await res.json() as { data?: { inboundToken?: string; outboundToken?: string } };
      if (json.data) {
        setRotatedTokens((prev) => ({ ...prev, [id]: json.data! }));
      }
    } catch { /* ignore */ }
  };

  const revokeTokens = async (id: string) => {
    if (!confirm('Revoke all tokens? This will deactivate the agent.')) return;
    try {
      await fetch(`/api/external-agents/${id}/token`, { method: 'DELETE' });
      void fetchAgents();
    } catch { /* ignore */ }
  };

  const removeAgent = async (id: string) => {
    if (!confirm('Remove this external agent permanently?')) return;
    try {
      await fetch(`/api/external-agents/${id}`, { method: 'DELETE' });
      void fetchAgents();
    } catch { /* ignore */ }
  };

  const upgradeTier = async (id: string) => {
    try {
      await fetch(`/api/external-agents/${id}/upgrade`, { method: 'POST' });
      void fetchAgents();
    } catch { /* ignore */ }
  };

  const viewProtocolPack = async (id: string) => {
    try {
      const res = await fetch(`/api/external-agents/${id}/protocol-pack`);
      if (!res.ok) return;
      const json = await res.json() as { data: Record<string, unknown> };
      setProtocolPack(json.data);
      setProtocolPackAgentId(id);
    } catch { /* ignore */ }
  };

  if (loading) return <div style={{ padding: 20, color: 'var(--text-muted)' }}>Loading…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {agents.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No external agents registered. Use the Invite button in the sidebar to add one.
        </div>
      ) : (
        agents.map((agent) => (
          <div key={agent.id} style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 14,
          }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{agent.emoji}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{agent.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {agent.tier === 'enhanced' ? '⭐ Enhanced' : '📦 Lightweight'} · {agent.role}
                  </div>
                </div>
              </div>
              <StatusBadge status={agent.status} failureCount={agent.failureCount} />
            </div>

            {/* Description */}
            {agent.description && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{agent.description}</div>
            )}

            {/* Details */}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>Webhook: <code style={{ fontSize: 10 }}>{agent.webhookUrl}</code></span>
              {agent.lastSeenAt && <span>Last seen: {new Date(agent.lastSeenAt).toLocaleString()}</span>}
              {agent.capabilities.length > 0 && <span>Capabilities: {agent.capabilities.join(', ')}</span>}
            </div>

            {/* Rotated tokens display */}
            {rotatedTokens[agent.id] && (
              <div style={{
                background: 'var(--bg)', border: '1px solid var(--coral)',
                borderRadius: 6, padding: 10, marginBottom: 10, fontSize: 11,
              }}>
                <div style={{ fontWeight: 600, color: 'var(--coral)', marginBottom: 4 }}>⚠️ New tokens (save now — shown once)</div>
                {rotatedTokens[agent.id]!.inboundToken && (
                  <div>Inbound: <code style={{ fontSize: 10, userSelect: 'all' }}>{rotatedTokens[agent.id]!.inboundToken}</code></div>
                )}
                {rotatedTokens[agent.id]!.outboundToken && (
                  <div>Outbound: <code style={{ fontSize: 10, userSelect: 'all' }}>{rotatedTokens[agent.id]!.outboundToken}</code></div>
                )}
              </div>
            )}

            {/* Test result */}
            {testResults[agent.id] !== undefined && testResults[agent.id] !== null && (
              <div style={{
                fontSize: 11, marginBottom: 8, padding: '4px 8px',
                borderRadius: 4, background: testResults[agent.id]!.ok ? 'var(--green-subtle)' : 'var(--red-subtle)',
                color: testResults[agent.id]!.ok ? 'var(--green)' : 'var(--red)',
              }}>
                {testResults[agent.id]!.msg}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <ActionBtn label="🔌 Test" onClick={() => void testConnection(agent.id)} />
              <ActionBtn label="🔄 Rotate tokens" onClick={() => void rotateTokens(agent.id)} />
              <ActionBtn label="🚫 Revoke" onClick={() => void revokeTokens(agent.id)} variant="danger" />
              {agent.tier === 'lightweight' && (
                <ActionBtn label="⭐ Upgrade to Enhanced" onClick={() => void upgradeTier(agent.id)} />
              )}
              {agent.tier === 'enhanced' && (
                <ActionBtn label="📋 Protocol Pack" onClick={() => void viewProtocolPack(agent.id)} />
              )}
              <ActionBtn label="🗑️ Remove" onClick={() => void removeAgent(agent.id)} variant="danger" />
            </div>
          </div>
        ))
      )}

      {/* M-3: Protocol Pack modal */}
      {protocolPack && protocolPackAgentId && (
        <div onClick={() => { setProtocolPack(null); setProtocolPackAgentId(null); }} style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'var(--surface)', borderRadius: 10,
            border: '1px solid var(--border)',
            width: 560, maxHeight: '80vh', overflow: 'auto',
            padding: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>📋 Protocol Pack</span>
              <button onClick={() => { setProtocolPack(null); setProtocolPackAgentId(null); }} style={{
                background: 'none', border: 'none', fontSize: 16, color: 'var(--text-muted)', cursor: 'pointer',
              }}>✕</button>
            </div>
            <pre style={{
              fontSize: 11, fontFamily: 'var(--font-mono)',
              background: 'var(--bg)', padding: 12, borderRadius: 6,
              overflow: 'auto', maxHeight: '60vh',
              color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {JSON.stringify(protocolPack, null, 2)}
            </pre>
            <button onClick={() => {
              void navigator.clipboard.writeText(JSON.stringify(protocolPack, null, 2));
            }} style={{
              marginTop: 10, fontSize: 12, padding: '6px 14px', borderRadius: 6,
              background: 'var(--coral-subtle)', color: 'var(--coral)',
              border: '1px solid var(--border)', cursor: 'pointer',
            }}>📋 Copy to clipboard</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, failureCount }: { status: string; failureCount: number }) {
  const colors: Record<string, { bg: string; fg: string; label: string }> = {
    active: { bg: 'var(--green-subtle)', fg: 'var(--green)', label: '● Active' },
    inactive: { bg: 'var(--surface-hover)', fg: 'var(--text-muted)', label: '○ Inactive' },
    error: { bg: 'var(--red-subtle)', fg: 'var(--red)', label: `⚠ Error (${failureCount} failures)` },
  };
  const c = colors[status] ?? colors.inactive;
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, padding: '2px 8px',
      borderRadius: 10, background: c.bg, color: c.fg,
    }}>{c.label}</span>
  );
}

function ActionBtn({ label, onClick, variant }: { label: string; onClick: () => void; variant?: 'danger' }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 11, padding: '4px 10px', borderRadius: 6,
      background: variant === 'danger' ? 'var(--red-subtle)' : 'var(--surface-hover)',
      color: variant === 'danger' ? 'var(--red)' : 'var(--text-secondary)',
      border: '1px solid var(--border)',
      cursor: 'pointer',
    }}>{label}</button>
  );
}
