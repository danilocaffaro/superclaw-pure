'use client';

import { useState, useEffect, useCallback } from 'react';
import { SectionTitle } from './shared';

interface CredentialEntry {
  name: string;
  masked: string;
  source: 'openclaw' | 'superclaw';
}

export default function VaultTab() {
  const [credentials, setCredentials] = useState<CredentialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Try to get credentials from OpenClaw Bridge config
      const res = await fetch('/api/config');
      if (res.ok) {
        const j = await res.json();
        const config = j.data ?? {};
        // Extract provider keys and known env patterns
        const creds: CredentialEntry[] = [];
        const providers = config.providers ?? config.config?.providers ?? {};
        for (const [name, val] of Object.entries(providers)) {
          if (val && typeof val === 'object' && 'apiKey' in (val as Record<string, unknown>)) {
            const key = (val as Record<string, string>).apiKey ?? '';
            creds.push({
              name: `${name.toUpperCase()}_API_KEY`,
              masked: key ? key.slice(0, 4) + '••••' + key.slice(-4) : '(not set)',
              source: 'openclaw',
            });
          }
        }
        // Common env vars
        for (const envKey of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GITHUB_TOKEN', 'GOOGLE_API_KEY', 'BRAVE_API_KEY']) {
          if (!creds.find(c => c.name === envKey)) {
            creds.push({ name: envKey, masked: '(check OpenClaw config)', source: 'openclaw' });
          }
        }
        setCredentials(creds);
      } else {
        setError('Unable to connect to OpenClaw');
      }
    } catch {
      setError('Server unavailable');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <SectionTitle
        title="Vault" aria-label="Vault"
        desc="Credentials managed by OpenClaw. Edit via OpenClaw config or environment variables."
      />

      {/* Status */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px',
        borderRadius: 'var(--radius-lg)',
        background: error ? 'rgba(255,107,107,0.08)' : 'var(--green-subtle)',
        border: `1px solid ${error ? 'rgba(255,107,107,0.25)' : 'rgba(63,185,80,0.25)'}`,
        marginBottom: 20,
      }}>
        <span style={{ fontSize: 20 }}>{error ? '⚠️' : '🔐'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: error ? 'var(--coral)' : 'var(--green)' }}>
            {error ? 'Connection Issue' : 'Managed by OpenClaw'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {error ?? `${credentials.length} credential${credentials.length !== 1 ? 's' : ''} detected`}
          </div>
        </div>
        <button
          onClick={load}
          style={{
            padding: '6px 14px', borderRadius: 'var(--radius-md)',
            background: 'var(--surface-hover)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Credentials list */}
      {loading ? (
        <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>
      ) : (
        <div>
          <div style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
            textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10,
          }}>
            🔑 Detected Credentials
          </div>
          <div style={{
            background: 'var(--card-bg)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', overflow: 'hidden',
          }}>
            {credentials.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                No credentials detected. Configure them in your OpenClaw config.
              </div>
            ) : (
              credentials.map((cred, i) => (
                <div key={cred.name} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px',
                  borderBottom: i < credentials.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14 }}>🔑</span>
                    <span style={{
                      fontSize: 13, color: 'var(--text)',
                      fontFamily: 'var(--font-mono)',
                    }}>{cred.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 11, color: 'var(--text-muted)',
                      padding: '2px 8px', borderRadius: 4,
                      background: 'var(--surface-hover)',
                      fontFamily: 'var(--font-mono)',
                    }}>{cred.masked}</span>
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 4,
                      background: 'rgba(88,166,255,0.1)', color: 'var(--blue)',
                      fontWeight: 500,
                    }}>
                      {cred.source}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Help text */}
          <div style={{
            marginTop: 16, padding: '12px 16px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--surface-hover)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              💡 Credentials are managed by OpenClaw&apos;s configuration system.
              To add or modify credentials, edit your OpenClaw config file or set environment variables.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
