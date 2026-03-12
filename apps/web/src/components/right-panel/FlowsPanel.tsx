'use client';

import { useState, useEffect } from 'react';
import { useWorkflowStore, type WorkflowTemplate, type WorkflowRun } from '@/stores/workflow-store';

const CATEGORY_LABELS: Record<string, string> = {
  development: '💻 Development',
  content:     '✍️ Content',
  research:    '🔬 Research',
  operations:  '⚙️ Operations',
};

const STEP_STATUS_COLOR: Record<string, string> = {
  pending: 'var(--text-muted)',
  running: 'var(--blue)',
  done:    'var(--green)',
  failed:  'var(--coral)',
};

const STEP_STATUS_BG: Record<string, string> = {
  pending: 'var(--surface-hover)',
  running: 'rgba(88,166,255,0.15)',
  done:    'rgba(63,185,80,0.15)',
  failed:  'rgba(255,107,107,0.15)',
};

function stepStatusIcon(status: WorkflowRun['steps'][number]['status']): string {
  switch (status) {
    case 'pending': return '○';
    case 'running': return '◌';
    case 'done':    return '✓';
    case 'failed':  return '✗';
  }
}

interface ActiveRunCardProps {
  run: WorkflowRun;
  templateName: string;
  templateEmoji: string;
  onCancel: (id: string) => void;
}

function ActiveRunCard({ run, templateName, templateEmoji, onCancel }: ActiveRunCardProps) {
  const doneCount = run.steps.filter((s) => s.status === 'done').length;
  const total = run.steps.length;
  const progress = total > 0 ? (doneCount / total) * 100 : 0;

  return (
    <div style={{
      padding: 14,
      borderRadius: 10,
      background: 'var(--card-bg)',
      border: `1px solid ${run.status === 'completed' ? 'rgba(63,185,80,0.4)' : run.status === 'failed' ? 'rgba(255,107,107,0.4)' : 'rgba(88,166,255,0.3)'}`,
      backdropFilter: 'blur(8px)',
      marginBottom: 8,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>{templateEmoji}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{templateName}</span>
        <span style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
          background: run.status === 'completed' ? 'rgba(63,185,80,0.15)' : run.status === 'failed' ? 'rgba(255,107,107,0.15)' : 'rgba(88,166,255,0.15)',
          color: run.status === 'completed' ? 'var(--green)' : run.status === 'failed' ? 'var(--coral)' : 'var(--blue)',
          textTransform: 'uppercase' as const, letterSpacing: '0.05em',
        }}>
          {run.status}
        </span>
        {run.status === 'running' && (
          <span style={{ fontSize: 10, color: 'var(--green, #3FB950)', marginLeft: 8 }}>● Live</span>
        )}
        <button
          onClick={() => onCancel(run.id)}
          title="Dismiss" aria-label="Dismiss"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 14, lineHeight: 1, padding: '0 2px',
          }}
        >✕</button>
      </div>

      {/* Progress bar */}
      {run.status === 'running' && (
        <div style={{ marginBottom: 10, height: 3, borderRadius: 2, background: 'var(--surface-hover)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2, background: 'var(--blue)',
            width: `${progress}%`, transition: 'width 0.4s ease',
          }} />
        </div>
      )}
      {run.status === 'completed' && (
        <div style={{ marginBottom: 10, height: 3, borderRadius: 2, background: 'rgba(63,185,80,0.3)' }}>
          <div style={{ height: '100%', borderRadius: 2, background: 'var(--green)', width: '100%' }} />
        </div>
      )}

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {run.steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 11, width: 14, textAlign: 'center', flexShrink: 0,
              color: STEP_STATUS_COLOR[step.status],
              animation: step.status === 'running' ? 'pulse 1s ease-in-out infinite' : undefined,
            }}>
              {stepStatusIcon(step.status)}
            </span>
            <span style={{
              fontSize: 11,
              color: step.status === 'pending' ? 'var(--text-muted)' : step.status === 'done' ? 'var(--text-secondary)' : 'var(--text)',
              flex: 1,
            }}>
              {step.name}
            </span>
            {step.duration !== undefined && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {(step.duration / 1000).toFixed(1)}s
              </span>
            )}
            {step.status === 'running' && (
              <span style={{ fontSize: 10, color: 'var(--blue)' }}>running…</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface TemplateCardProps {
  template: WorkflowTemplate;
  onLaunch: (id: string) => void;
  isRunning: boolean;
}

function TemplateCard({ template, onLaunch, isRunning }: TemplateCardProps) {
  const [hovered, setHovered] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: 14,
        borderRadius: 10,
        background: 'var(--card-bg)',
        border: `1px solid ${hovered ? 'rgba(88,166,255,0.4)' : 'var(--glass-border)'}`,
        backdropFilter: 'blur(8px)',
        cursor: 'default',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>{template.emoji}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>{template.name}</span>
        <span style={{
          fontSize: 10, color: 'var(--text-muted)', background: 'var(--surface-hover)',
          padding: '2px 6px', borderRadius: 8, flexShrink: 0,
        }}>
          {template.steps.length} steps
        </span>
      </div>

      {/* Description */}
      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.5, margin: '0 0 10px 0' }}>
        {template.description}
      </p>

      {/* Step pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4, marginBottom: 12 }}>
        {template.steps.map((step, i) => (
          <span key={i} style={{
            padding: '2px 8px', borderRadius: 10,
            background: 'var(--surface-hover)', fontSize: 10,
            color: 'var(--text-muted)',
          }}>
            {step.name}
          </span>
        ))}
      </div>

      {/* Launch button */}
      <button
        onClick={() => onLaunch(template.id)}
        disabled={isRunning}
        onMouseEnter={() => setBtnHovered(true)}
        onMouseLeave={() => setBtnHovered(false)}
        style={{
          width: '100%', padding: '6px 0', borderRadius: 6,
          background: isRunning
            ? 'var(--surface-hover)'
            : btnHovered
            ? 'rgba(88,166,255,0.2)'
            : 'rgba(88,166,255,0.08)',
          border: isRunning
            ? '1px solid var(--border)'
            : '1px solid rgba(88,166,255,0.3)',
          color: isRunning ? 'var(--text-muted)' : 'var(--blue)',
          fontSize: 12, fontWeight: 500,
          cursor: isRunning ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {isRunning ? '▶ Running…' : '▶ Launch Workflow'}
      </button>
    </div>
  );
}

// ── N8n Status Panel ─────────────────────────────────────────────────────────

interface N8nStatus {
  connected: boolean;
  url: string;
  hasApiKey?: boolean;
  workflowCount?: number;
  error?: string;
}

interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  updatedAt?: string;
}

function N8nPanel() {
  const [status, setStatus] = useState<N8nStatus | null>(null);
  const [workflows, setWorkflows] = useState<N8nWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [wfLoading, setWfLoading] = useState(false);
  const [n8nUrl, setN8nUrl] = useState('http://localhost:5678');
  const [n8nKey, setN8nKey] = useState('');
  const [configuring, setConfiguring] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/n8n/status');
      const json = await res.json();
      setStatus(json.data);
      if (json.data.url) setN8nUrl(json.data.url);
    } catch {
      setStatus({ connected: false, url: n8nUrl, error: 'Server unreachable' });
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflows = async () => {
    setWfLoading(true);
    try {
      const res = await fetch('/api/n8n/workflows');
      const json = await res.json();
      setWorkflows(Array.isArray(json.data) ? json.data : []);
    } catch { setWorkflows([]); }
    finally { setWfLoading(false); }
  };

  useEffect(() => {
    fetchStatus();
    fetch('/api/n8n/config').then(r => r.json()).then(j => {
      if (j.data?.url) setN8nUrl(j.data.url);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status?.connected) fetchWorkflows();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.connected]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      await fetch('/api/n8n/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: n8nUrl, apiKey: n8nKey }),
      });
      setConfiguring(false);
      await fetchStatus();
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
      Connecting to n8n…
    </div>
  );

  if (!status?.connected && !configuring) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
      <div style={{ fontSize: 28 }}>🔌</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>n8n not connected</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
        {status?.error ?? 'Connect to your n8n instance to run real automations.'}
      </div>
      <button onClick={() => setConfiguring(true)} style={{
        padding: '8px 20px', borderRadius: 8,
        background: 'var(--coral)', color: '#fff', border: 'none',
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
      }}>
        Connect n8n
      </button>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        Not using n8n? <a href="https://n8n.io" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}>Get started free</a>
      </div>
    </div>
  );

  if (configuring) return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Configure n8n</div>
      <div>
        <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>n8n URL</label>
        <input value={n8nUrl} onChange={e => setN8nUrl(e.target.value)}
          placeholder="http://localhost:5678"
          style={{ width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6,
            background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
            fontSize: 12, outline: 'none', boxSizing: 'border-box' as const }} />
      </div>
      <div>
        <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>API Key (optional)</label>
        <input value={n8nKey} onChange={e => setN8nKey(e.target.value)}
          type="password" placeholder="n8n_api_key_..."
          style={{ width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6,
            background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
            fontSize: 12, outline: 'none', boxSizing: 'border-box' as const }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={saveConfig} disabled={saving} style={{
          flex: 1, padding: '7px 0', borderRadius: 8,
          background: 'var(--coral)', color: '#fff', border: 'none',
          fontSize: 12, fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
        }}>{saving ? 'Saving…' : 'Save & Connect'}</button>
        <button onClick={() => setConfiguring(false)} style={{
          padding: '7px 12px', borderRadius: 8,
          background: 'var(--surface-hover)', color: 'var(--text-secondary)',
          border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer',
        }}>Cancel</button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* n8n connected header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Connected — {status?.url}</span>
        </div>
        <button onClick={() => setConfiguring(true)} style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 4,
          background: 'transparent', border: '1px solid var(--border)',
          color: 'var(--text-muted)', cursor: 'pointer',
        }}>Edit</button>
      </div>

      {/* Workflow list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {wfLoading && (
          <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>Loading workflows…</div>
        )}
        {!wfLoading && workflows.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>📋</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No workflows in n8n yet</div>
            <a href={`${n8nUrl}/workflow/new`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: 'var(--blue)', display: 'block', marginTop: 4 }}>
              Create one in n8n →
            </a>
          </div>
        )}
        {workflows.map((wf) => (
          <div key={wf.id} style={{
            padding: '8px 12px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{wf.name}</div>
              <div style={{ fontSize: 10, color: wf.active ? 'var(--green)' : 'var(--text-muted)' }}>
                {wf.active ? '● Active' : '○ Inactive'}
              </div>
            </div>
            <a href={`${n8nUrl}/workflow/${wf.id}`} target="_blank" rel="noopener noreferrer"
              style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 4,
                background: 'var(--surface-hover)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', textDecoration: 'none',
              }}>Open ↗</a>
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowsPanel() {
  const { templates, activeRuns, fetchTemplates, startWorkflow, cancelRun, cleanup } = useWorkflowStore();
  const [subTab, setSubTab] = useState<'workflows' | 'n8n'>('workflows');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
    const timer = setTimeout(() => setLoading(false), 500);
    return () => {
      clearTimeout(timer);
      cleanup();
    };
  }, [fetchTemplates]);

  const categories = ['all', ...Array.from(new Set(templates.map((t) => t.category)))];

  const filtered = templates.filter((t) => {
    const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
    const q = search.toLowerCase();
    const matchesSearch = !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const runningTemplateIds = new Set(
    activeRuns.filter((r) => r.status === 'running').map((r) => r.templateId)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sub-tab bar */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0,
        padding: '0 4px', background: 'var(--glass-bg)',
      }}>
        {(['workflows', 'n8n'] as const).map((tab) => (
          <button key={tab} onClick={() => setSubTab(tab)} style={{
            padding: '8px 12px', fontSize: 11, fontWeight: 500,
            background: 'none', border: 'none', cursor: 'pointer',
            color: subTab === tab ? 'var(--text)' : 'var(--text-muted)',
            position: 'relative',
            textTransform: 'capitalize' as const,
          }}>
            {tab === 'n8n' ? 'n8n Live' : 'Templates'}
            {subTab === tab && (
              <span style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
                background: 'var(--coral)', borderRadius: '2px 2px 0 0',
              }} />
            )}
          </button>
        ))}
      </div>

      {/* n8n sub-tab */}
      {subTab === 'n8n' && <N8nPanel />}

      {/* Workflows sub-tab */}
      {subTab === 'workflows' && <>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
          Workflow Templates
        </span>
        {activeRuns.filter((r) => r.status === 'running').length > 0 && (
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 10,
            background: 'rgba(88,166,255,0.15)', color: 'var(--blue)',
            fontWeight: 600,
          }}>
            {activeRuns.filter((r) => r.status === 'running').length} running
          </span>
        )}
      </div>

      {/* Search + filter bar */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search workflows…"
          style={{
            width: '100%', padding: '5px 10px', borderRadius: 6,
            background: 'var(--bg)', border: '1px solid var(--border)',
            color: 'var(--text)', fontSize: 12, outline: 'none',
            boxSizing: 'border-box' as const,
          }}
        />
        {/* Category filter chips */}
        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' as const }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '2px 10px', borderRadius: 10, fontSize: 10,
                fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                background: activeCategory === cat ? 'rgba(188,140,255,0.15)' : 'var(--surface-hover)',
                border: activeCategory === cat ? '1px solid rgba(188,140,255,0.4)' : '1px solid transparent',
                color: activeCategory === cat ? 'var(--purple)' : 'var(--text-muted)',
                textTransform: cat === 'all' ? 'capitalize' as const : 'capitalize' as const,
              }}
            >
              {cat === 'all' ? '⊞ All' : (CATEGORY_LABELS[cat] ?? cat)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Loading state */}
        {loading && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24, fontSize: 13 }}>
            Loading workflows…
          </div>
        )}

        {/* Active runs section */}
        {activeRuns.length > 0 && (
          <div>
            <div style={{
              fontSize: 10, color: 'var(--text-muted)', marginBottom: 8,
              fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
            }}>
              Active Runs
            </div>
            {activeRuns.map((run) => {
              const tpl = templates.find((t) => t.id === run.templateId);
              return (
                <ActiveRunCard
                  key={run.id}
                  run={run}
                  templateName={tpl?.name ?? run.templateId}
                  templateEmoji={tpl?.emoji ?? '◇'}
                  onCancel={cancelRun}
                />
              );
            })}
          </div>
        )}

        {/* Template cards */}
        {filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '32px 16px',
            border: '1px dashed var(--border)', borderRadius: 10,
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>◇</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {search ? `No workflows match "${search}"` : 'No workflows in this category'}
            </div>
          </div>
        ) : (
          <div>
            <div style={{
              fontSize: 10, color: 'var(--text-muted)', marginBottom: 8,
              fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
            }}>
              {activeCategory === 'all' ? 'All Templates' : (CATEGORY_LABELS[activeCategory] ?? activeCategory)}
              <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontWeight: 400 }}>
                ({filtered.length})
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onLaunch={startWorkflow}
                  isRunning={runningTemplateIds.has(template.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      </>}
    </div>
  );
}

// ─── Console Panel ────────────────────────────────────────────────────────────

export default FlowsPanel;
