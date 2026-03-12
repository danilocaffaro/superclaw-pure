'use client';

import { useState } from 'react';
import { SectionTitle, Toggle } from './shared';

// ─── Integrations Tab ────────────────────────────────────────────────────────────

interface GitHubConnection {
  connected: boolean;
  username: string | null;
  repos: string[];
  token: string;
  showToken: boolean;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  lastTriggered: string | null;
  status: 'active' | 'failing' | 'disabled';
}

export default function IntegrationsTab() {
  const [github, setGithub] = useState<GitHubConnection>({
    connected: false, username: null, repos: [], token: '', showToken: false,
  });
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([
    { id: 'wh-1', url: '', events: ['session.created', 'message.new'], enabled: false, lastTriggered: null, status: 'disabled' },
  ]);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);

  const WEBHOOK_EVENTS = [
    'session.created', 'session.ended', 'message.new', 'agent.status',
    'task.created', 'task.completed', 'squad.run', 'error',
  ];

  const testGitHub = async () => {
    if (!github.token.trim()) return;
    setTesting(true);
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${github.token}`, Accept: 'application/vnd.github+json' },
      });
      if (res.ok) {
        const user = await res.json();
        setGithub((g) => ({ ...g, connected: true, username: user.login }));
        // Try to get repos
        const repoRes = await fetch('https://api.github.com/user/repos?per_page=10&sort=updated', {
          headers: { Authorization: `Bearer ${github.token}`, Accept: 'application/vnd.github+json' },
        });
        if (repoRes.ok) {
          const repos = await repoRes.json();
          setGithub((g) => ({ ...g, repos: repos.map((r: { full_name: string }) => r.full_name) }));
        }
      } else {
        setGithub((g) => ({ ...g, connected: false, username: null }));
      }
    } catch {
      setGithub((g) => ({ ...g, connected: false }));
    }
    setTesting(false);
  };

  const disconnectGitHub = () => {
    setGithub({ connected: false, username: null, repos: [], token: '', showToken: false });
  };

  const addWebhook = () => {
    setWebhooks((prev) => [...prev, {
      id: 'wh-' + Date.now(),
      url: '',
      events: ['message.new'],
      enabled: false,
      lastTriggered: null,
      status: 'disabled' as const,
    }]);
  };

  const updateWebhook = <K extends keyof WebhookEndpoint>(id: string, key: K, val: WebhookEndpoint[K]) => {
    setWebhooks((prev) => prev.map((w) => w.id === id ? { ...w, [key]: val } : w));
  };

  const removeWebhook = (id: string) => {
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  };

  const toggleWebhookEvent = (whId: string, event: string) => {
    setWebhooks((prev) => prev.map((w) => {
      if (w.id !== whId) return w;
      const events = w.events.includes(event)
        ? w.events.filter((e) => e !== event)
        : [...w.events, event];
      return { ...w, events };
    }));
  };

  const handleSave = async () => {
    try {
      await fetch('/api/config/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          github: { token: github.token, connected: github.connected },
          webhooks: webhooks.map((w) => ({ url: w.url, events: w.events, enabled: w.enabled })),
        }),
      });
    } catch { /* graceful */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <SectionTitle title="Integrations" aria-label="Integrations" desc="Connect external services and configure webhook endpoints." />

      {/* ── GitHub ────────────────────────────────────── */}
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
        textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10,
      }}>
        🐙 GitHub
      </div>

      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 24,
      }}>
        {/* Connection status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 24 }}>🐙</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>GitHub</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {github.connected ? `Connected as @${github.username}` : 'Not connected'}
            </div>
          </div>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: github.connected ? 'var(--green)' : 'var(--text-muted)',
            boxShadow: github.connected ? '0 0 6px var(--green)' : 'none',
          }} />
        </div>

        {/* Token input */}
        {!github.connected && (
          <div style={{ marginBottom: 12 }}>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)',
              textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5,
            }}>
              Personal Access Token
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type={github.showToken ? 'text' : 'password'}
                value={github.token}
                onChange={(e) => setGithub((g) => ({ ...g, token: e.target.value }))}
                placeholder="ghp_..."
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: 'var(--radius-md)',
                  background: 'var(--input-bg)', border: '1px solid var(--border)',
                  color: 'var(--text)', fontSize: 13, outline: 'none',
                  fontFamily: github.showToken ? 'var(--font-mono)' : 'var(--font-sans)',
                  transition: 'border-color 150ms',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--coral)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              />
              <button
                onClick={() => setGithub((g) => ({ ...g, showToken: !g.showToken }))}
                style={{
                  width: 34, height: 34, borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-hover)', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {github.showToken ? '🙈' : '👁️'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Requires <code style={{ fontSize: 10, padding: '1px 4px', borderRadius: 2, background: 'var(--surface-hover)' }}>repo</code> scope. Create at{' '}
              <span style={{ color: 'var(--coral)', cursor: 'pointer' }}
                onClick={() => window.open('https://github.com/settings/tokens/new', '_blank')}
              >
                github.com/settings/tokens
              </span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {!github.connected ? (
            <button
              onClick={testGitHub}
              disabled={testing || !github.token.trim()}
              style={{
                padding: '6px 14px', borderRadius: 'var(--radius-md)',
                background: testing || !github.token.trim() ? 'var(--surface-hover)' : 'var(--coral)',
                border: 'none',
                color: testing || !github.token.trim() ? 'var(--text-muted)' : '#fff',
                fontSize: 12, fontWeight: 600, cursor: testing || !github.token.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 150ms',
              }}
            >
              {testing ? '⟳ Connecting…' : '⚡ Connect'}
            </button>
          ) : (
            <button
              onClick={disconnectGitHub}
              style={{
                padding: '6px 14px', borderRadius: 'var(--radius-md)',
                background: 'var(--surface-hover)', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
                transition: 'all 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--coral)'; e.currentTarget.style.color = 'var(--coral)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              Disconnect
            </button>
          )}
        </div>

        {/* Connected repos */}
        {github.connected && github.repos.length > 0 && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Recent Repositories
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {github.repos.slice(0, 8).map((repo) => (
                <span key={repo} style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-hover)', border: '1px solid var(--border)',
                  color: 'var(--text)', fontFamily: 'var(--font-mono)', cursor: 'pointer',
                }}
                  onClick={() => window.open(`https://github.com/${repo}`, '_blank')}
                >
                  {repo}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Webhooks ──────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
          textTransform: 'uppercase', letterSpacing: '0.6px',
        }}>
          🔔 Webhook Endpoints
        </div>
        <button
          onClick={addWebhook}
          style={{
            padding: '4px 12px', borderRadius: 'var(--radius-md)',
            background: 'var(--surface-hover)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer',
            transition: 'all 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--coral)'; e.currentTarget.style.color = 'var(--coral)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          + Add Webhook
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {webhooks.map((wh) => (
          <div key={wh.id} style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: '14px 16px',
          }}>
            {/* URL + enable toggle */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <input
                type="url"
                value={wh.url}
                onChange={(e) => updateWebhook(wh.id, 'url', e.target.value)}
                placeholder="https://your-app.com/webhooks/superclaw"
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: 'var(--radius-md)',
                  background: 'var(--input-bg)', border: '1px solid var(--border)',
                  color: 'var(--text)', fontSize: 12, outline: 'none',
                  fontFamily: 'var(--font-mono)', transition: 'border-color 150ms',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--coral)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              />
              <Toggle
                checked={wh.enabled}
                onChange={(v) => updateWebhook(wh.id, 'enabled', v)}
              />
              <button
                onClick={() => removeWebhook(wh.id)}
                style={{
                  width: 28, height: 28, borderRadius: 'var(--radius-md)',
                  background: 'none', border: 'none', color: 'var(--text-muted)',
                  fontSize: 13, cursor: 'pointer', transition: 'color 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--coral)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                ✕
              </button>
            </div>

            {/* Event subscriptions */}
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Events:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {WEBHOOK_EVENTS.map((ev) => {
                const selected = wh.events.includes(ev);
                return (
                  <button
                    key={ev}
                    onClick={() => toggleWebhookEvent(wh.id, ev)}
                    style={{
                      padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                      background: selected ? 'var(--coral-subtle)' : 'var(--surface-hover)',
                      border: `1px solid ${selected ? 'rgba(255,107,107,0.3)' : 'var(--border)'}`,
                      color: selected ? 'var(--coral)' : 'var(--text-muted)',
                      fontSize: 10, cursor: 'pointer', fontFamily: 'var(--font-mono)',
                      transition: 'all 150ms',
                    }}
                  >
                    {ev}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        style={{
          padding: '8px 18px', borderRadius: 'var(--radius-md)',
          background: saved ? 'var(--green)' : 'var(--coral)',
          color: '#fff', border: 'none', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', transition: 'all 200ms',
        }}
        onMouseEnter={(e) => { if (!saved) e.currentTarget.style.opacity = '0.85'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
      >
        {saved ? '✓ Saved!' : 'Save Integrations'}
      </button>
    </div>
  );
}

