'use client';

import { useState, useEffect, useCallback } from 'react';

interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  tags: string[];
  downloads: number;
  rating: number;
  ratingCount: number;
  icon: string;
  installed: boolean;
}

const CATEGORIES = ['all', 'development', 'data', 'creative', 'communication'] as const;

export function MarketplacePanel() {
  const [skills, setSkills] = useState<MarketplaceSkill[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [filter, setFilter] = useState<'all' | 'installed'>('all');
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category !== 'all') params.set('category', category);
      if (filter === 'installed') params.set('installed', 'true');
      const res = await fetch(`/api/marketplace?${params.toString()}`);
      if (res.ok) {
        const data = await res.json() as { data: MarketplaceSkill[] };
        setSkills(data.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [search, category, filter]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const toggleInstall = async (skill: MarketplaceSkill) => {
    setActionId(skill.id);
    try {
      const action = skill.installed ? 'uninstall' : 'install';
      const res = await fetch(`/api/marketplace/${skill.id}/${action}`, { method: 'POST' });
      if (res.ok) await fetchSkills();
    } finally {
      setActionId(null);
    }
  };

  const installedCount = skills.filter((s) => s.installed).length;

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            🏪 Skills Marketplace
          </h2>
          {installedCount > 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--green)',
                background: 'rgba(63,185,80,0.12)',
                border: '1px solid rgba(63,185,80,0.3)',
                padding: '2px 8px',
                borderRadius: 10,
              }}
            >
              {installedCount} installed
            </span>
          )}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
          Browse, install, and manage agent skills
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search skills..."
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 8,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            fontSize: 13,
            outline: 'none',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--purple)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        />
      </div>

      {/* Category filters */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
        {CATEGORIES.map((c) => {
          const active = category === c;
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                textTransform: 'capitalize',
                background: active ? 'rgba(188,140,255,0.12)' : 'var(--surface-hover)',
                color: active ? 'var(--purple)' : 'var(--text-muted)',
                border: active ? '1px solid rgba(188,140,255,0.3)' : '1px solid var(--border)',
                transition: 'all 120ms',
              }}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* All / Installed toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {(['all', 'installed'] as const).map((f) => {
          const active = filter === f;
          const color = f === 'installed' ? 'var(--green)' : 'var(--blue)';
          const activeBg = f === 'installed' ? 'rgba(63,185,80,0.1)' : 'rgba(88,166,255,0.1)';
          const activeBorder = f === 'installed' ? 'rgba(63,185,80,0.3)' : 'rgba(88,166,255,0.3)';
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '4px 14px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                textTransform: 'capitalize',
                background: active ? activeBg : 'transparent',
                color: active ? color : 'var(--text-muted)',
                border: active ? `1px solid ${activeBorder}` : '1px solid transparent',
                transition: 'all 120ms',
              }}
            >
              {f === 'installed' ? '✅ Installed' : '🌐 All'}
            </button>
          );
        })}
      </div>

      {/* Skill Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
          Loading skills...
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {skills.map((skill) => {
            const isActing = actionId === skill.id;
            return (
              <div
                key={skill.id}
                style={{
                  padding: '14px 16px',
                  borderRadius: 10,
                  background: 'var(--card-bg)',
                  border: `1px solid ${skill.installed ? 'rgba(63,185,80,0.2)' : 'var(--glass-border)'}`,
                  backdropFilter: 'blur(8px)',
                  transition: 'border-color 150ms',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  {/* Icon */}
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: 'var(--surface-hover)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    {skill.icon}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 3,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                        {skill.name}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: 'var(--text-muted)',
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'var(--surface-hover)',
                          fontFamily: 'monospace',
                        }}
                      >
                        v{skill.version}
                      </span>
                      {skill.installed && (
                        <span
                          style={{
                            fontSize: 10,
                            color: 'var(--green)',
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: 'rgba(63,185,80,0.12)',
                            border: '1px solid rgba(63,185,80,0.25)',
                            fontWeight: 600,
                          }}
                        >
                          Installed
                        </span>
                      )}
                    </div>

                    <p
                      style={{
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        marginBottom: 6,
                        lineHeight: 1.45,
                        margin: '0 0 6px 0',
                      }}
                    >
                      {skill.description}
                    </p>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        fontSize: 11,
                        color: 'var(--text-muted)',
                      }}
                    >
                      <span>by {skill.author}</span>
                      <span>⬇ {skill.downloads.toLocaleString()}</span>
                      <span>
                        ⭐ {skill.rating.toFixed(1)}{' '}
                        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                          ({skill.ratingCount})
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Install/Uninstall button */}
                  <button
                    onClick={() => toggleInstall(skill)}
                    disabled={isActing}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: isActing ? 'not-allowed' : 'pointer',
                      flexShrink: 0,
                      opacity: isActing ? 0.6 : 1,
                      background: skill.installed
                        ? 'rgba(255,107,107,0.1)'
                        : 'rgba(63,185,80,0.1)',
                      color: skill.installed ? 'var(--coral)' : 'var(--green)',
                      border: `1px solid ${
                        skill.installed
                          ? 'rgba(255,107,107,0.3)'
                          : 'rgba(63,185,80,0.3)'
                      }`,
                      transition: 'all 150ms',
                    }}
                  >
                    {isActing
                      ? '⟳'
                      : skill.installed
                      ? 'Uninstall'
                      : 'Install'}
                  </button>
                </div>

                {/* Tags */}
                {skill.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
                    {skill.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          padding: '2px 8px',
                          borderRadius: 10,
                          background: 'var(--surface-hover)',
                          fontSize: 10,
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {skills.length === 0 && !loading && (
            <div
              style={{
                textAlign: 'center',
                padding: 48,
                color: 'var(--text-muted)',
                fontSize: 13,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
              <div style={{ fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
                No skills found
              </div>
              <div>Try a different search or category</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
