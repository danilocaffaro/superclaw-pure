'use client';

import React, { useState, useEffect } from 'react';
import { SectionTitle, SettingRow, Toggle } from './shared';
import { useUIStore } from '@/stores/ui-store';

// ─── Appearance Tab ──────────────────────────────────────────────────────────────

export default function AppearanceTab() {
  const { theme, setTheme, interfaceMode, setInterfaceMode } = useUIStore();
  const [fontSize, setFontSize] = useState(14);
  const [compactMode, setCompactMode] = useState(false);

  const themes: { key: 'dark' | 'light' | 'system'; label: string; icon: string }[] = [
    { key: 'dark', label: 'Dark', icon: '🌙' },
    { key: 'light', label: 'Light', icon: '☀️' },
    { key: 'system', label: 'System', icon: '💻' },
  ];

  return (
    <div>
      <SectionTitle title="Appearance" aria-label="Appearance" desc="Customize the look and feel of the interface." />

      {/* Theme cards */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
          Theme
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {themes.map((t) => (
            <button
              key={t.key}
              onClick={() => setTheme(t.key)}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 'var(--radius-lg)',
                border: `2px solid ${theme === t.key ? 'var(--coral)' : 'var(--border)'}`,
                background: theme === t.key ? 'var(--coral-subtle)' : 'var(--surface)',
                cursor: 'pointer',
                transition: 'all 150ms',
                textAlign: 'center',
              }}
            >
              {/* Mini preview */}
              <div
                style={{
                  width: '100%',
                  height: 48,
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 8,
                  overflow: 'hidden',
                  border: '1px solid var(--border)',
                  position: 'relative',
                  background: t.key === 'light' ? '#ffffff' : '#0D1117',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 14,
                    background: t.key === 'light' ? '#f5f5f5' : '#161B22',
                    borderBottom: `1px solid ${t.key === 'light' ? '#e0e0e0' : '#30363D'}`,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 18,
                    left: 6,
                    right: 6,
                    height: 6,
                    borderRadius: 3,
                    background: t.key === 'light' ? '#e0e0e0' : '#30363D',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 28,
                    left: 6,
                    width: '60%',
                    height: 6,
                    borderRadius: 3,
                    background: '#FF6B6B',
                    opacity: 0.6,
                  }}
                />
                {t.key === 'system' && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      bottom: 0,
                      right: '50%',
                      background: '#0D1117',
                      borderRight: '1px solid #30363D',
                    }}
                  />
                )}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                {t.icon} {t.label}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Interface Mode */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
          Interface Mode
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setInterfaceMode('lite')}
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
              background: interfaceMode === 'lite' ? 'var(--blue-subtle, rgba(88,166,255,0.1))' : 'var(--surface-hover)',
              border: interfaceMode === 'lite' ? '1px solid rgba(88,166,255,0.3)' : '1px solid var(--border)',
              textAlign: 'left', transition: 'all 150ms',
            }}
          >
            <div style={{
              fontSize: 14, fontWeight: 600,
              color: interfaceMode === 'lite' ? 'var(--blue)' : 'var(--text)',
              marginBottom: 4,
            }}>💬 Lite</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Clean chat experience. No squads, code panels, or automations.
            </div>
          </button>
          <button
            onClick={() => setInterfaceMode('pro')}
            style={{
              flex: 1, padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
              background: interfaceMode === 'pro' ? 'var(--purple-subtle, rgba(188,140,255,0.1))' : 'var(--surface-hover)',
              border: interfaceMode === 'pro' ? '1px solid rgba(188,140,255,0.3)' : '1px solid var(--border)',
              textAlign: 'left', transition: 'all 150ms',
            }}
          >
            <div style={{
              fontSize: 14, fontWeight: 600,
              color: interfaceMode === 'pro' ? 'var(--purple)' : 'var(--text)',
              marginBottom: 4,
            }}>⚡ Pro</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Full dashboard with squads, code, sprints, and workflows.
            </div>
          </button>
        </div>
      </div>

      <div>
        <SettingRow
          label="Font size"
          desc={`Interface font size. Current: ${fontSize}px`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>12</span>
            <input
              type="range"
              min={12}
              max={18}
              step={1}
              value={fontSize}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setFontSize(v);
                document.documentElement.style.fontSize = `${v}px`;
              }}
              style={{ width: 120, accentColor: 'var(--coral)', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>18</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--coral)',
                width: 32,
                textAlign: 'right',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {fontSize}px
            </span>
          </div>
        </SettingRow>

        <SettingRow
          label="Compact mode"
          desc="Reduce padding and spacing throughout the UI."
        >
          <Toggle checked={compactMode} onChange={setCompactMode} />
        </SettingRow>
      </div>
    </div>
  );
}

