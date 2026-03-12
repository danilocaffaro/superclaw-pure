'use client';

import React, { useState, useEffect } from 'react';
import { SectionTitle } from './shared';

// ─── Skills Tab (B072) — curated skill library ────────────────────

interface Skill {
  name: string;
  description?: string;
  location?: string;
  enabled?: boolean;
}

export default function SkillsTab() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [reloading, setReloading] = useState(false);

  const load = () => {
    fetch('/api/skills')
      .then(r => r.json())
      .then((d: { data?: { skills?: Skill[] } | Skill[] }) => {
        const raw = d?.data;
        const list = Array.isArray(raw) ? raw : raw?.skills ?? [];
        setSkills(list);
      })
      .catch(() => setSkills([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleReload = async () => {
    setReloading(true);
    try {
      await fetch('/api/skills/reload', { method: 'POST' });
      load();
    } catch { /* ignore */ } finally { setReloading(false); }
  };

  const filtered = skills.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <SectionTitle
        title="Skills"
        desc={`${skills.length} skills installed. Skills extend agent capabilities.`}
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search skills…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, padding: '7px 12px', borderRadius: 'var(--radius-md)',
            background: 'var(--input-bg)', border: '1px solid var(--border)',
            color: 'var(--text)', fontSize: 13, outline: 'none',
          }}
        />
        <button
          onClick={handleReload}
          disabled={reloading}
          style={{
            padding: '7px 14px', borderRadius: 'var(--radius-md)',
            background: 'var(--surface-hover)', border: '1px solid var(--border)',
            color: 'var(--fg-muted)', fontSize: 12, cursor: reloading ? 'not-allowed' : 'pointer',
          }}
        >
          {reloading ? '⟳ Reloading…' : '⟳ Reload'}
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--fg-muted)', fontSize: 13, padding: '16px 0' }}>Loading skills…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: 'var(--fg-muted)', fontSize: 13, padding: '16px 0' }}>
          {search ? 'No skills match your search.' : 'No skills found.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map((s, i) => (
            <div key={s.name + i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '10px 14px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚡</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{s.name}</div>
                {s.description && (
                  <div style={{ fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.4 }}>{s.description}</div>
                )}
              </div>
              <span style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 99,
                background: 'rgba(63,185,80,0.1)', color: 'var(--green)',
                fontWeight: 600, flexShrink: 0,
              }}>installed</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
