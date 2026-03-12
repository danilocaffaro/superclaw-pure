'use client';

import React, { useState, useEffect } from 'react';
import { SectionTitle } from './shared';

// ─── MCP Tab (B071) — real MCP servers from SuperClaw engine ─────────────────

interface MCPServer {
  id: string;
  name?: string;
  transport?: string;
  status?: string;
  tools?: number;
}

interface MCPTool {
  name: string;
  description?: string;
  serverId: string;
}

export default function MCPTab() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectUrl, setConnectUrl] = useState('');
  const [connecting, setConnecting] = useState(false);

  const load = () => {
    fetch('/api/mcp/servers')
      .then(r => r.json())
      .then((d: { data?: { connected?: MCPServer[]; tools?: MCPTool[] } }) => {
        setServers(d?.data?.connected ?? []);
        setTools(d?.data?.tools ?? []);
      })
      .catch(() => { setServers([]); setTools([]); })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleConnect = async () => {
    if (!connectUrl.trim()) return;
    setConnecting(true);
    try {
      await fetch('/api/mcp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: connectUrl.split('/').pop() ?? 'server', transport: connectUrl }),
      });
      setConnectUrl('');
      load();
    } catch { /* ignore */ } finally { setConnecting(false); }
  };

  const handleDisconnect = async (serverId: string) => {
    await fetch('/api/mcp/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId }),
    });
    load();
  };

  return (
    <div>
      <SectionTitle
        title="MCP Servers"
        desc={`${servers.length} server${servers.length !== 1 ? 's' : ''} connected, ${tools.length} tool${tools.length !== 1 ? 's' : ''} available.`}
      />

      {/* Connect new server */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Server transport URL or command…"
          value={connectUrl}
          onChange={e => setConnectUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleConnect()}
          style={{
            flex: 1, padding: '7px 12px', borderRadius: 'var(--radius-md)',
            background: 'var(--input-bg)', border: '1px solid var(--border)',
            color: 'var(--text)', fontSize: 13, outline: 'none',
          }}
        />
        <button
          onClick={handleConnect}
          disabled={connecting || !connectUrl.trim()}
          style={{
            padding: '7px 14px', borderRadius: 'var(--radius-md)',
            background: 'var(--coral)', border: 'none',
            color: '#fff', fontSize: 12, fontWeight: 600,
            cursor: connecting ? 'not-allowed' : 'pointer', opacity: connecting ? 0.6 : 1,
          }}
        >
          {connecting ? '⟳ Connecting…' : '+ Connect'}
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--fg-muted)', fontSize: 13, padding: '16px 0' }}>Loading…</div>
      ) : servers.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', padding: 32, textAlign: 'center',
          color: 'var(--fg-muted)',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔌</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
            No MCP Servers Connected
          </div>
          <div style={{ fontSize: 13 }}>
            Connect a server above to expose its tools to your agents.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {servers.map(s => {
            const serverTools = tools.filter(t => t.serverId === s.id);
            return (
              <div key={s.id} style={{
                padding: '12px 14px', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: serverTools.length ? 8 : 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{s.name ?? s.id}</span>
                  <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{serverTools.length} tools</span>
                  <button
                    onClick={() => handleDisconnect(s.id)}
                    style={{
                      padding: '3px 10px', borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)',
                      color: 'var(--coral)', fontSize: 11, cursor: 'pointer',
                    }}
                  >
                    Disconnect
                  </button>
                </div>
                {serverTools.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 18 }}>
                    {serverTools.map(t => (
                      <span key={t.name} title={t.description} style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 99,
                        background: 'var(--surface-hover)', color: 'var(--fg-muted)',
                      }}>
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
