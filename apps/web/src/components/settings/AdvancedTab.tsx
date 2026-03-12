'use client';

import { useState } from 'react';
import { SectionTitle, SettingRow, Toggle } from './shared';

export default function AdvancedTab() {
  const getStored = (key: string, def: boolean) => {
    if (typeof window === 'undefined') return def;
    return localStorage.getItem(key) === 'true';
  };

  const [debugMode, setDebugMode] = useState(() => getStored('sc-debug', false));
  const [streamingLogs, setStreamingLogs] = useState(() => getStored('sc-stream-logs', false));
  const [experimentalSquads, setExperimentalSquads] = useState(() => getStored('sc-exp-squads', false));
  const [experimentalBrowser, setExperimentalBrowser] = useState(() => getStored('sc-exp-browser', false));

  const toggle = (key: string, setter: (v: boolean) => void) => (v: boolean) => {
    setter(v);
    localStorage.setItem(key, String(v));
  };

  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.2.0';

  const clearCache = async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      localStorage.clear();
      sessionStorage.clear();
      alert('Cache cleared. Reloading...');
      window.location.reload();
    } catch {
      alert('Cache cleared (partial).');
    }
  };

  const resetDefaults = () => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <div>
      <SectionTitle
        title="Advanced" aria-label="Advanced"
        desc="Debug tools, experimental features, and developer settings."
      />

      <SettingRow label="Debug mode" desc="Show verbose logs in the browser console.">
        <Toggle checked={debugMode} onChange={toggle('sc-debug', setDebugMode)} />
      </SettingRow>

      <SettingRow label="Streaming logs" desc="Log streaming tokens to console in real-time.">
        <Toggle checked={streamingLogs} onChange={toggle('sc-stream-logs', setStreamingLogs)} />
      </SettingRow>

      <div style={{ marginTop: 24, marginBottom: 8 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
          textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12,
        }}>
          Experimental Features
        </div>
      </div>

      <SettingRow label="Experimental squads" desc="Enable squad features under active development.">
        <Toggle checked={experimentalSquads} onChange={toggle('sc-exp-squads', setExperimentalSquads)} />
      </SettingRow>

      <SettingRow label="Experimental browser" desc="Enable agent browser control (beta).">
        <Toggle checked={experimentalBrowser} onChange={toggle('sc-exp-browser', setExperimentalBrowser)} />
      </SettingRow>

      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
          textTransform: 'uppercase', letterSpacing: '0.6px',
        }}>
          Maintenance
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={clearCache}
            style={{
              padding: '7px 16px', borderRadius: 'var(--radius-md)',
              background: 'var(--surface-hover)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 13, cursor: 'pointer',
              transition: 'all 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--yellow)'; e.currentTarget.style.color = 'var(--yellow)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)'; }}
          >
            🗑️ Clear Cache
          </button>
          <button
            onClick={resetDefaults}
            style={{
              padding: '7px 16px', borderRadius: 'var(--radius-md)',
              background: 'var(--surface-hover)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 13, cursor: 'pointer',
              transition: 'all 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--coral)'; e.currentTarget.style.color = 'var(--coral)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)'; }}
          >
            ↩️ Reset to Defaults
          </button>
        </div>
      </div>

      {/* Version info */}
      <div style={{
        marginTop: 32, padding: '12px 16px',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>
          Version Info
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            ['SuperClaw', appVersion],
            ['Next.js', '15.x'],
            ['React', '19.x'],
          ].map(([name, ver]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {ver}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
