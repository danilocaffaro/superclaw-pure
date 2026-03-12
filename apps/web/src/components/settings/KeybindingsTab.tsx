'use client';

import React, { useState, useEffect } from 'react';
import { SectionTitle, Toggle } from './shared';

// ─── Keybindings Tab ─────────────────────────────────────────────────────────────

const KEYBINDINGS = [
  { action: 'Open Settings', keys: ['⌘', ','] },
  { action: 'Command Palette', keys: ['⌘', 'K'] },
  { action: 'New Chat', keys: ['⌘', 'N'] },
  { action: 'Toggle Sidebar', keys: ['⌘', 'B'] },
  { action: 'Toggle Right Panel', keys: ['⌘', '\\'] },
  { action: 'Toggle Interface Mode', keys: ['⌘', '⇧', 'L'] },
  { action: 'Send Message', keys: ['Enter'] },
  { action: 'New Line', keys: ['Shift', 'Enter'] },
  { action: 'Focus Input', keys: ['/', 'Esc'] },
  { action: 'Switch Tab ←', keys: ['⌘', '['] },
  { action: 'Switch Tab →', keys: ['⌘', ']'] },
];

export default function KeybindingsTab() {
  return (
    <div>
      <SectionTitle
        title="Keybindings" aria-label="Keybindings"
        desc="Keyboard shortcuts for common actions."
      />
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {KEYBINDINGS.map((kb, i) => (
          <div
            key={kb.action}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              borderBottom: i < KEYBINDINGS.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--text)' }}>{kb.action}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {kb.keys.map((k) => (
                <kbd
                  key={k}
                  style={{
                    padding: '2px 7px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface-hover)',
                    border: '1px solid var(--border)',
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {k}
                </kbd>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Settings Panel ─────────────────────────────────────────────────────────

