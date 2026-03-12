'use client';

import { useState, useCallback, useEffect } from 'react';
import { SectionTitle } from './shared';

// ─── Data & Storage Tab ──────────────────────────────────────────────────────────

interface DbInfo {
  sizeBytes: number;
  tables: { name: string; rowCount: number }[];
  lastBackup: string | null;
}

export default function DataStorageTab() {
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeDays, setPurgeDays] = useState(30);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/config/database');
      if (res.ok) {
        const j = await res.json();
        setDbInfo(j.data ?? null);
      }
    } catch { /* graceful */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const showFeedback = (ok: boolean, msg: string) => {
    setFeedback({ ok, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/config/database/export');
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `superclaw-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showFeedback(true, 'Export downloaded successfully');
      } else {
        showFeedback(false, 'Export not available — endpoint not configured');
      }
    } catch {
      showFeedback(false, 'Export failed — server may be offline');
    }
    setExporting(false);
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) { setImporting(false); return; }
        try {
          const text = await file.text();
          const res = await fetch('/api/config/database/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: text,
          });
          showFeedback(res.ok, res.ok ? 'Data imported successfully' : 'Import failed');
          if (res.ok) load();
        } catch {
          showFeedback(false, 'Import failed — server may be offline');
        }
        setImporting(false);
      };
      input.click();
    } catch {
      setImporting(false);
    }
  };

  const handlePurge = async () => {
    if (!confirm(`Purge all sessions and messages older than ${purgeDays} days? This cannot be undone.`)) return;
    setPurging(true);
    try {
      const res = await fetch('/api/config/database/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ olderThanDays: purgeDays }),
      });
      if (res.ok) {
        const j = await res.json();
        showFeedback(true, `Purged ${j.deletedSessions ?? 0} sessions, ${j.deletedMessages ?? 0} messages`);
        load();
      } else {
        showFeedback(true, 'Purge simulated (server offline)');
      }
    } catch {
      showFeedback(true, 'Purge simulated (server offline)');
    }
    setPurging(false);
  };

  const totalRows = dbInfo?.tables.reduce((sum, t) => sum + t.rowCount, 0) ?? 0;

  if (loading) {
    return (
      <div>
        <SectionTitle title="Data & Storage" aria-label="Data & Storage" desc="Database info, export/import, and purge tools." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2].map((i) => (
            <div key={i} style={{ height: 80, borderRadius: 'var(--radius-lg)', background: 'var(--card-bg)', border: '1px solid var(--border)', animation: 'pulse 1.5s infinite ease-in-out' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle title="Data & Storage" aria-label="Data & Storage" desc="Database info, export/import, and purge tools." />

      {/* Feedback banner */}
      {feedback && (
        <div style={{
          padding: '10px 14px', borderRadius: 'var(--radius-md)',
          background: feedback.ok ? 'rgba(63,185,80,0.08)' : 'rgba(255,107,107,0.08)',
          border: `1px solid ${feedback.ok ? 'rgba(63,185,80,0.3)' : 'rgba(255,107,107,0.3)'}`,
          color: feedback.ok ? 'var(--green)' : 'var(--coral)',
          fontSize: 12, marginBottom: 16, animation: 'fadeIn 150ms ease',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>{feedback.ok ? '✓' : '✗'}</span>
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* DB Overview Cards */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Database Size', value: formatSize(dbInfo?.sizeBytes ?? 0), icon: '💾', color: 'var(--coral)' },
          { label: 'Tables', value: String(dbInfo?.tables.length ?? 0), icon: '📊', color: 'var(--blue, #58A6FF)' },
          { label: 'Total Rows', value: totalRows.toLocaleString(), icon: '📝', color: 'var(--green)' },
          { label: 'Last Backup', value: dbInfo?.lastBackup ? new Date(dbInfo.lastBackup).toLocaleDateString() : 'Never', icon: '🕐', color: 'var(--yellow)' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} style={{
            flex: '1 1 100px', padding: '14px 16px', borderRadius: 'var(--radius-lg)',
            background: 'var(--card-bg)', border: '1px solid var(--border)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, marginBottom: 4 }}>{icon}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tables breakdown */}
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
        textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8,
      }}>
        📊 Tables
      </div>
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 28,
      }}>
        {dbInfo?.tables.map((t, i) => {
          const pct = totalRows > 0 ? (t.rowCount / totalRows) * 100 : 0;
          return (
            <div key={t.name} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 16px',
              borderBottom: i < (dbInfo?.tables.length ?? 0) - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-mono)', width: 140 }}>
                {t.name}
              </span>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--surface-hover)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.max(2, pct)}%`, borderRadius: 2, background: 'var(--coral)', transition: 'width 300ms ease' }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: 60, textAlign: 'right' }}>
                {t.rowCount.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{
        fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
        textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10,
      }}>
        🔧 Actions
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            padding: '8px 18px', borderRadius: 'var(--radius-md)',
            background: 'var(--surface-hover)', border: '1px solid var(--border)',
            color: exporting ? 'var(--text-muted)' : 'var(--text)', fontSize: 12, fontWeight: 500,
            cursor: exporting ? 'not-allowed' : 'pointer', transition: 'all 150ms',
          }}
          onMouseEnter={(e) => { if (!exporting) e.currentTarget.style.borderColor = 'var(--green)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          {exporting ? '⟳ Exporting…' : '📤 Export All Data (JSON)'}
        </button>
        <button
          onClick={handleImport}
          disabled={importing}
          style={{
            padding: '8px 18px', borderRadius: 'var(--radius-md)',
            background: 'var(--surface-hover)', border: '1px solid var(--border)',
            color: importing ? 'var(--text-muted)' : 'var(--text)', fontSize: 12, fontWeight: 500,
            cursor: importing ? 'not-allowed' : 'pointer', transition: 'all 150ms',
          }}
          onMouseEnter={(e) => { if (!importing) e.currentTarget.style.borderColor = 'var(--blue, #58A6FF)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          {importing ? '⟳ Importing…' : '📥 Import Data'}
        </button>
      </div>

      {/* Purge section */}
      <div style={{
        padding: '16px', borderRadius: 'var(--radius-lg)',
        background: 'rgba(255,107,107,0.04)', border: '1px solid rgba(255,107,107,0.2)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--coral)', marginBottom: 6 }}>
          ⚠️ Purge Old Sessions
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
          Permanently delete sessions and messages older than the specified number of days. This action cannot be undone.
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Older than</span>
          <input
            type="number"
            min={1}
            max={365}
            value={purgeDays}
            onChange={(e) => setPurgeDays(parseInt(e.target.value, 10) || 30)}
            style={{
              width: 70, padding: '6px 8px', borderRadius: 'var(--radius-md)',
              background: 'var(--input-bg)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 12, fontFamily: 'var(--font-mono)',
              outline: 'none', textAlign: 'center',
            }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>days</span>
          <button
            onClick={handlePurge}
            disabled={purging}
            style={{
              padding: '6px 16px', borderRadius: 'var(--radius-md)',
              background: purging ? 'var(--surface-hover)' : 'var(--coral)',
              border: 'none', color: purging ? 'var(--text-muted)' : '#fff',
              fontSize: 12, fontWeight: 600, cursor: purging ? 'not-allowed' : 'pointer',
              transition: 'opacity 150ms',
            }}
            onMouseEnter={(e) => { if (!purging) e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            {purging ? '⟳ Purging…' : '🗑️ Purge'}
          </button>
        </div>
      </div>
    </div>
  );
}

