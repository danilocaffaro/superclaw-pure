'use client';

import { useState, useEffect, useCallback } from 'react';
import { SectionTitle } from './shared';

interface BuildInfo {
  version: string;
  buildTime: string;
  nodeVersion: string;
  engine: string;
  uptime: number;
}

interface UsageSummary {
  sessions: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalTokens: number;
  totalCostUsd: number;
  records: number;
}

interface DailyUsage {
  day: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  calls: number;
}

interface ModelUsage {
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  calls: number;
}

interface HealthData {
  status: string;
  uptime: { ms: number; human: string };
  memory: { heapUsedMb: number; heapTotalMb: number; rssMb: number };
  database: { agents: number; sessions: number; memoryEntries: number };
  circuits: { total: number; open: number; closed: number; halfOpen: number };
  node: { version: string; platform: string; arch: string };
}

export default function DeploysTab() {
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [modelUsage, setModelUsage] = useState<ModelUsage[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'usage' | 'health'>('overview');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, usageRes, dailyRes, modelRes] = await Promise.allSettled([
        fetch('/api/health').then(r => r.ok ? r.json() : null),
        fetch('/api/analytics/usage').then(r => r.ok ? r.json() : null),
        fetch('/api/analytics/usage/daily?days=14').then(r => r.ok ? r.json() : null),
        fetch('/api/analytics/usage/model').then(r => r.ok ? r.json() : null),
        fetch('/api/analytics/health').then(r => r.ok ? r.json() : null),
      ]);

      if (healthRes.status === 'fulfilled' && healthRes.value) setBuildInfo(healthRes.value);
      if (usageRes.status === 'fulfilled' && usageRes.value?.data) setUsage(usageRes.value.data);
      if (dailyRes.status === 'fulfilled' && dailyRes.value?.data) setDailyUsage(dailyRes.value.data);
      if (modelRes.status === 'fulfilled' && modelRes.value?.data) setModelUsage(modelRes.value.data);
    } catch { /* server offline */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Fetch analytics/health separately (it has different shape from /api/health)
  useEffect(() => {
    fetch('/api/analytics/health')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.data) setHealth(d.data); })
      .catch(() => {});
  }, []);

  const formatTokens = (n: number) => {
    if (!n) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  const formatCost = (usd: number) => {
    if (!usd) return '$0.00';
    if (usd < 0.001) return `$${(usd * 1000).toFixed(3)}m`;
    return `$${usd.toFixed(4)}`;
  };

  const maxBarCost = dailyUsage.length ? Math.max(...dailyUsage.map(d => d.cost), 0.0001) : 1;

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'usage', label: '💸 Usage' },
    { id: 'health', label: '🩺 Health' },
  ] as const;

  return (
    <div>
      <SectionTitle
        title="System & Analytics"
        aria-label="System & Analytics"
        desc="Server health, token usage, and cost tracking."
      />

      {/* Sub-tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 16,
        borderBottom: '1px solid var(--border)', paddingBottom: 8,
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '5px 12px', fontSize: 12, borderRadius: 'var(--radius-sm)',
              border: 'none', cursor: 'pointer',
              background: activeTab === t.id ? 'var(--accent)' : 'transparent',
              color: activeTab === t.id ? '#fff' : 'var(--text-secondary)',
              fontWeight: activeTab === t.id ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={load}
          style={{
            marginLeft: 'auto', padding: '5px 10px', fontSize: 11,
            background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            color: 'var(--text-muted)',
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
      ) : (
        <>
          {/* ── Overview ── */}
          {activeTab === 'overview' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                {[
                  { label: 'Engine', value: buildInfo?.engine ?? 'native', icon: '⚡' },
                  { label: 'Version', value: buildInfo?.version ?? '0.1.0', icon: '📦' },
                  { label: 'Uptime', value: health?.uptime.human ?? '—', icon: '⏱️' },
                  { label: 'Status', value: health?.status ?? 'unknown', icon: health?.status === 'ok' ? '🟢' : '🟡' },
                  { label: 'Node.js', value: health?.node.version ?? '—', icon: '🟢' },
                  { label: 'Heap', value: health ? `${health.memory.heapUsedMb}/${health.memory.heapTotalMb} MB` : '—', icon: '🧠' },
                ].map(item => (
                  <div key={item.label} style={{
                    padding: '12px 14px',
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                      {item.icon} {item.label}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', wordBreak: 'break-all' }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* DB stats */}
              {health?.database && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Database
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                      { label: 'Agents', value: health.database.agents },
                      { label: 'Sessions', value: health.database.sessions },
                      { label: 'Memories', value: health.database.memoryEntries },
                    ].map(item => (
                      <div key={item.label} style={{
                        padding: '10px 12px', background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-sm)', textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{item.value}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Usage ── */}
          {activeTab === 'usage' && (
            <div>
              {/* Summary cards */}
              {usage && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
                  {[
                    { label: 'Total Cost', value: formatCost(usage.totalCostUsd), icon: '💸', accent: true },
                    { label: 'Total Tokens', value: formatTokens(usage.totalTokens), icon: '🔢' },
                    { label: 'Tokens In', value: formatTokens(usage.totalTokensIn), icon: '📥' },
                    { label: 'Tokens Out', value: formatTokens(usage.totalTokensOut), icon: '📤' },
                    { label: 'Sessions', value: String(usage.sessions), icon: '💬' },
                    { label: 'LLM Calls', value: String(usage.records), icon: '📡' },
                  ].map(item => (
                    <div key={item.label} style={{
                      padding: '12px 14px',
                      background: item.accent ? 'var(--accent)' : 'var(--card-bg)',
                      border: `1px solid ${item.accent ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-md)',
                    }}>
                      <div style={{ fontSize: 10, color: item.accent ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)', marginBottom: 4 }}>
                        {item.icon} {item.label}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: item.accent ? '#fff' : 'var(--text)' }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Daily cost chart (SVG bar chart) */}
              {dailyUsage.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Daily Cost — Last {dailyUsage.length} days
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, padding: '0 4px' }}>
                    {dailyUsage.map(d => {
                      const pct = maxBarCost > 0 ? (d.cost / maxBarCost) * 100 : 0;
                      const label = d.day.slice(5); // MM-DD
                      return (
                        <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
                          <div
                            title={`${label}: ${formatCost(d.cost)} (${d.calls} calls)`}
                            style={{
                              flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end',
                            }}
                          >
                            <div style={{
                              width: '100%', background: 'var(--accent)',
                              height: `${Math.max(pct, 2)}%`,
                              borderRadius: '2px 2px 0 0', opacity: 0.8,
                              transition: 'height 0.3s',
                              minHeight: 2,
                            }} />
                          </div>
                          <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 3, whiteSpace: 'nowrap' }}>
                            {label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Model breakdown */}
              {modelUsage.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                    By Model
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {modelUsage.slice(0, 8).map(m => (
                      <div key={`${m.provider}/${m.model}`} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', background: 'var(--card-bg)',
                        border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.model}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.provider} · {m.calls} calls</div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{formatCost(m.cost)}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatTokens((m.tokensIn ?? 0) + (m.tokensOut ?? 0))} tok</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!usage && !loading && (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No usage data yet. Start chatting to see costs here.
                </div>
              )}
            </div>
          )}

          {/* ── Health ── */}
          {activeTab === 'health' && (
            <div>
              {health ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Memory */}
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Process Memory
                    </div>
                    {[
                      { label: 'Heap Used', value: health.memory.heapUsedMb, total: health.memory.heapTotalMb },
                      { label: 'RSS', value: health.memory.rssMb, total: health.memory.rssMb },
                    ].map(m => (
                      <div key={m.label} style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{m.label}</span>
                          <span style={{ color: 'var(--text)', fontWeight: 600 }}>{m.value} MB</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 3 }}>
                          <div style={{
                            height: '100%', borderRadius: 3,
                            background: m.value > 400 ? 'var(--error)' : m.value > 200 ? 'var(--warning, #f59e0b)' : 'var(--success, #22c55e)',
                            width: `${Math.min((m.value / 512) * 100, 100)}%`,
                            transition: 'width 0.3s',
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Circuit Breakers */}
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Circuit Breakers
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {[
                        { label: 'Total', value: health.circuits.total, color: 'var(--text)' },
                        { label: 'Closed', value: health.circuits.closed, color: 'var(--success, #22c55e)' },
                        { label: 'Open', value: health.circuits.open, color: 'var(--error, #ef4444)' },
                        { label: 'Half-Open', value: health.circuits.halfOpen, color: 'var(--warning, #f59e0b)' },
                      ].map(c => (
                        <div key={c.label} style={{ textAlign: 'center', padding: '10px 8px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{c.value}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Runtime */}
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Runtime
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[
                        { label: 'Platform', value: `${health.node.platform} (${health.node.arch})` },
                        { label: 'Node.js', value: health.node.version },
                        { label: 'Uptime', value: health.uptime.human },
                      ].map(item => (
                        <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle, var(--border))' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item.label}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  📡 Unable to reach server health endpoint.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
