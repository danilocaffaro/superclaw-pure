'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SectionTitle } from './shared';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Gateway {
  id: string;
  name: string;
  url: string;
  tunnel_port?: number;
  tunnel_host: string;
  ssh_target?: string;
  enabled: boolean | number;
  status: 'connected' | 'disconnected' | 'error';
  last_error?: string;
  created_at: string;
  updated_at: string;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const API = '/gateways';

async function fetchGateways(): Promise<Gateway[]> {
  const res = await fetch(API);
  const json = await res.json();
  return json.data ?? [];
}

async function createGateway(body: Partial<Gateway>): Promise<Gateway> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to create gateway');
  return json.data;
}

async function deleteGateway(id: string): Promise<void> {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json.error || 'Failed to delete');
  }
}

async function healthCheck(id: string): Promise<{ status: string; healthy: boolean; latencyMs?: number | null; error?: string }> {
  const res = await fetch(`${API}/${id}/health`, { method: 'POST' });
  const json = await res.json();
  return json.data;
}

interface PoolGateway {
  id: string;
  connected: boolean;
  agents: string[];
  agentCount: number;
}

interface PoolStatus {
  initialized: boolean;
  gateways: PoolGateway[];
  totalAgents: number;
  connectedGateways: number;
  totalGateways: number;
}

async function fetchPoolStatus(): Promise<PoolStatus | null> {
  try {
    const res = await fetch(`${API}/pool-status`);
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string; dot: string }> = {
    connected: { bg: 'rgba(46,160,67,0.15)', text: '#3fb950', dot: '#3fb950' },
    disconnected: { bg: 'rgba(139,148,158,0.15)', text: '#8b949e', dot: '#8b949e' },
    error: { bg: 'rgba(248,81,73,0.15)', text: '#f85149', dot: '#f85149' },
  };
  const c = colors[status] || colors.disconnected;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 12,
      background: c.bg, color: c.text,
      fontSize: 11, fontWeight: 600,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />
      {status}
    </span>
  );
}

// ─── Add Gateway Form ─────────────────────────────────────────────────────────

function AddGatewayForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [tunnelPort, setTunnelPort] = useState('');
  const [sshTarget, setSshTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createGateway({
        name: name.trim(),
        url: url.trim(),
        tunnel_port: tunnelPort ? parseInt(tunnelPort) : undefined,
        ssh_target: sshTarget.trim() || undefined,
      });
      setName(''); setUrl(''); setTunnelPort(''); setSshTarget('');
      setExpanded(false);
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 16px', background: 'var(--surface-hover)',
        border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)',
        color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
        width: '100%', transition: 'all 150ms',
      }}>
        <span style={{ fontSize: 18 }}>+</span>
        Add Gateway
      </button>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    background: 'var(--input-bg)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', color: 'var(--text)', fontSize: 13,
  };

  return (
    <form onSubmit={handleSubmit} style={{
      padding: 16, background: 'var(--surface-hover)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. adler"
            style={inputStyle} required />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>WebSocket URL *</label>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="ws://100.70.217.4:18789"
            style={inputStyle} required />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Tunnel Port</label>
          <input value={tunnelPort} onChange={e => setTunnelPort(e.target.value)} placeholder="28789"
            style={inputStyle} type="number" />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>SSH Target</label>
          <input value={sshTarget} onChange={e => setSshTarget(e.target.value)} placeholder="root@100.70.217.4"
            style={inputStyle} />
        </div>
      </div>
      {error && <div style={{ color: '#f85149', fontSize: 12, marginBottom: 8 }}>⚠️ {error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={loading} style={{
          padding: '8px 20px', background: 'var(--coral)', color: '#fff',
          border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13,
          fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1,
        }}>
          {loading ? 'Connecting...' : 'Add Gateway'}
        </button>
        <button type="button" onClick={() => setExpanded(false)} style={{
          padding: '8px 16px', background: 'transparent', color: 'var(--text-secondary)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
          fontSize: 13, cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Gateway Card ─────────────────────────────────────────────────────────────

function GatewayCard({ gw, poolGw, onRefresh }: { gw: Gateway; poolGw?: PoolGateway; onRefresh: () => void }) {
  const [checking, setChecking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const handleHealthCheck = async () => {
    setChecking(true);
    try {
      const result = await healthCheck(gw.id);
      if (result.latencyMs != null) setLatencyMs(result.latencyMs);
      onRefresh();
    } finally {
      setChecking(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setDeleting(true);
    try {
      await deleteGateway(gw.id);
      onRefresh();
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const btnStyle: React.CSSProperties = {
    padding: '4px 10px', fontSize: 11, borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text-secondary)', cursor: 'pointer',
  };

  return (
    <div style={{
      padding: 14, background: 'var(--surface)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ fontSize: 24 }}>🌐</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{gw.name}</span>
          <StatusBadge status={gw.status} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono, monospace)' }}>
          {gw.tunnel_port ? `tunnel → localhost:${gw.tunnel_port}` : gw.url}
          {gw.ssh_target && <span style={{ marginLeft: 8, opacity: 0.6 }}>({gw.ssh_target})</span>}
        </div>
        {/* B057: Latency + agent count from BridgePool */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
          {latencyMs != null && (
            <span style={{ color: latencyMs < 200 ? 'var(--green)' : latencyMs < 1000 ? 'var(--yellow)' : 'var(--coral)' }}>
              ⚡ {latencyMs}ms
            </span>
          )}
          {poolGw && (
            <span>👥 {poolGw.agentCount} agent{poolGw.agentCount !== 1 ? 's' : ''}</span>
          )}
        </div>
        {gw.last_error && gw.status === 'error' && (
          <div style={{ fontSize: 11, color: '#f85149', marginTop: 4 }}>⚠️ {gw.last_error}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={handleHealthCheck} disabled={checking} style={btnStyle} title="Check health">
          {checking ? '⏳' : '🔄'}
        </button>
        <button onClick={handleDelete} disabled={deleting}
          style={{ ...btnStyle, ...(confirmDelete ? { borderColor: '#f85149', color: '#f85149' } : {}) }}
          title={confirmDelete ? 'Click again to confirm' : 'Delete gateway'}>
          {deleting ? '⏳' : confirmDelete ? '⚠️ Confirm?' : '🗑️'}
        </button>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{
      textAlign: 'center', padding: '40px 20px',
      color: 'var(--text-secondary)',
    }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🌐</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
        No Gateways Configured
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 400, margin: '0 auto' }}>
        Gateways connect SuperClaw to remote OpenClaw agents.
        Add a gateway to start chatting with agents on other machines.
      </div>
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────

export default function GatewaysTab() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [poolStatus, setPoolStatus] = useState<PoolStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [data, pool] = await Promise.all([fetchGateways(), fetchPoolStatus()]);
      setGateways(data);
      setPoolStatus(pool);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-refresh every 10s for live status updates
  useEffect(() => {
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  const connected = gateways.filter(g => g.status === 'connected').length;
  const total = gateways.length;

  // Build pool gateway lookup by name
  const poolMap = new Map<string, PoolGateway>();
  if (poolStatus?.gateways) {
    for (const pg of poolStatus.gateways) poolMap.set(pg.id, pg);
  }

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <SectionTitle
        title="Gateways"
        desc={total > 0
          ? `${connected}/${total} connected — manage your OpenClaw gateway connections`
          : 'Connect to remote OpenClaw agents via gateway bridges'}
      />

      {/* B057: BridgePool live dashboard */}
      {poolStatus?.initialized && (
        <div style={{
          display: 'flex', gap: 16, marginBottom: 16, padding: '10px 14px',
          background: 'var(--surface-hover)', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)', fontSize: 12,
        }}>
          {[
            { label: 'Gateways', value: `${poolStatus.connectedGateways}/${poolStatus.totalGateways}`, color: 'var(--green)' },
            { label: 'Agents', value: poolStatus.totalAgents, color: 'var(--blue, #58A6FF)' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-secondary)' }}>Loading...</div>
        ) : gateways.length === 0 ? (
          <EmptyState />
        ) : (
          gateways.map(gw => (
            <GatewayCard key={gw.id} gw={gw} poolGw={poolMap.get(gw.name)} onRefresh={refresh} />
          ))
        )}
      </div>

      <AddGatewayForm onCreated={refresh} />
    </div>
  );
}
