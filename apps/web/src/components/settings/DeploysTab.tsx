'use client';

import { useState, useEffect, useCallback } from 'react';
import { SectionTitle } from './shared';

interface BuildInfo {
  version: string;
  buildTime: string;
  nodeVersion: string;
  bridgeConnected: boolean;
  bridgeUrl: string;
  uptime: number;
}

export default function DeploysTab() {
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setBuildInfo(data);
      }
    } catch { /* server offline */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const formatUptime = (seconds: number) => {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div>
      <SectionTitle
        title="System Info" aria-label="System Info"
        desc="Server status and build information."
      />

      {loading ? (
        <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>
      ) : !buildInfo ? (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📡</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Unable to reach server. Make sure SuperClaw server is running.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, padding: '12px 0' }}>
          {[
            { label: 'Version', value: buildInfo.version || '0.2.0', icon: '📦' },
            { label: 'Uptime', value: formatUptime(buildInfo.uptime), icon: '⏱️' },
            { label: 'Node.js', value: buildInfo.nodeVersion || process.env.NODE_ENV || '—', icon: '🟢' },
            { label: 'Bridge', value: buildInfo.bridgeConnected ? '✅ Connected' : '❌ Disconnected', icon: '🔌' },
            { label: 'Bridge URL', value: buildInfo.bridgeUrl || 'ws://127.0.0.1:18789', icon: '🌐' },
            { label: 'Build Time', value: buildInfo.buildTime || '—', icon: '🕐' },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                padding: '14px 16px',
                background: 'var(--card-bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                {item.icon} {item.label}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', wordBreak: 'break-all' }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
