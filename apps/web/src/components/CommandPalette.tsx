'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { useSessionStore } from '@/stores/session-store';

// ─── Command definitions ──────────────────────────────────────────────────────
interface Command {
  id: string;
  label: string;
  description?: string;
  icon: string;
  shortcut?: string;
  category: 'session' | 'navigation' | 'settings' | 'agent' | 'action';
  action: () => void;
}

// ─── CommandPalette component ─────────────────────────────────────────────────
export default function CommandPalette() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    toggleSidebar,
    toggleRightPanel,
    setRightPanelTab,
    rightPanelCollapsed,
    setTheme,
    setSettingsOpen,
    interfaceMode,
    setInterfaceMode,
    toggleInterfaceMode,
  } = useUIStore();

  const { sessions, createSession, setActiveSession } = useSessionStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build command list dynamically (includes live sessions)
  const commands: Command[] = [
    // ── Sessions ──────────────────────────────────────────────────────────────
    {
      id: 'new-session',
      label: 'New Chat Session',
      description: 'Start a fresh conversation',
      icon: '💬',
      shortcut: '⌘N',
      category: 'session',
      action: () => {
        void createSession();
        setCommandPaletteOpen(false);
      },
    },
    ...sessions.slice(0, 5).map((s) => ({
      id: `switch-${s.id}`,
      label: `Switch to: ${s.title || 'Untitled'}`,
      description: 'Open this session',
      icon: '📄',
      category: 'session' as const,
      action: () => {
        setActiveSession(s.id);
        setCommandPaletteOpen(false);
      },
    })),

    // ── Navigation ────────────────────────────────────────────────────────────
    {
      id: 'toggle-sidebar',
      label: 'Toggle Sidebar',
      description: 'Show or hide the sidebar',
      icon: '◧',
      shortcut: '⌘B',
      category: 'navigation',
      action: () => {
        toggleSidebar();
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'toggle-panel',
      label: 'Toggle Right Panel',
      description: 'Show or hide the right panel',
      icon: '◨',
      shortcut: '⌘\\',
      category: 'navigation',
      action: () => {
        toggleRightPanel();
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'tab-code',
      label: 'Open Code Panel',
      description: 'Switch to the Code tab',
      icon: '📝',
      category: 'navigation',
      action: () => {
        setRightPanelTab('code');
        if (rightPanelCollapsed) toggleRightPanel();
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'tab-preview',
      label: 'Open Preview Panel',
      description: 'Switch to the Preview tab',
      icon: '🌐',
      category: 'navigation',
      action: () => {
        setRightPanelTab('preview');
        if (rightPanelCollapsed) toggleRightPanel();
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'tab-browser',
      label: 'Open Browser Panel',
      description: 'Switch to the Browser tab',
      icon: '🔭',
      category: 'navigation',
      action: () => {
        setRightPanelTab('browser');
        if (rightPanelCollapsed) toggleRightPanel();
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'tab-sprint',
      label: 'Open Sprint Panel',
      description: 'Switch to the Sprint tab',
      icon: '📋',
      category: 'navigation',
      action: () => {
        setRightPanelTab('sprint');
        if (rightPanelCollapsed) toggleRightPanel();
        setCommandPaletteOpen(false);
      },
    },

    // ── Settings ──────────────────────────────────────────────────────────────
    {
      id: 'settings',
      label: 'Open Settings',
      description: 'Configure providers, models, and more',
      icon: '⚙️',
      shortcut: '⌘,',
      category: 'settings',
      action: () => {
        setSettingsOpen(true);
        setCommandPaletteOpen(false);
      },
    },
    // ── Theme ──────────────────────────────────────────────────────────────────
    {
      id: 'theme-dark',
      label: 'Switch to Dark Theme',
      description: 'Use the dark color scheme',
      icon: '🌙',
      category: 'settings',
      action: () => {
        setTheme('dark');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'theme-light',
      label: 'Switch to Light Theme',
      description: 'Use the light color scheme',
      icon: '☀️',
      category: 'settings',
      action: () => {
        setTheme('light');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'theme-system',
      label: 'Switch to System Theme',
      description: 'Follow the OS color preference',
      icon: '💻',
      category: 'settings',
      action: () => {
        setTheme('system');
        setCommandPaletteOpen(false);
      },
    },

    // ── Interface Mode ────────────────────────────────────────────────────────
    {
      id: 'mode-lite',
      label: 'Switch to Lite Mode',
      description: 'Clean chat-only experience',
      icon: '💬',
      category: 'settings',
      action: () => {
        setInterfaceMode('lite');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'mode-pro',
      label: 'Switch to Pro Mode',
      description: 'Full dashboard with squads, code, sprints, and workflows',
      icon: '⚡',
      category: 'settings',
      action: () => {
        setInterfaceMode('pro');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'mode-toggle',
      label: 'Toggle Interface Mode',
      description: interfaceMode === 'lite' ? 'Switch to Pro mode' : 'Switch to Lite mode',
      icon: interfaceMode === 'lite' ? '⚡' : '💬',
      shortcut: '⌘⇧L',
      category: 'settings',
      action: () => {
        toggleInterfaceMode();
        setCommandPaletteOpen(false);
      },
    },
  ];

  // Filter commands by query
  const filtered = commands.filter((cmd) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      (cmd.description ?? '').toLowerCase().includes(q)
    );
  });

  // Reset on open
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [commandPaletteOpen]);

  // Clamp selected index when filter changes
  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  // Global ⌘K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % Math.max(1, filtered.length));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % Math.max(1, filtered.length));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filtered[selectedIndex];
        if (cmd) cmd.action();
        return;
      }
    },
    [filtered, selectedIndex, setCommandPaletteOpen],
  );

  if (!commandPaletteOpen) return null;

  return (
    /* Backdrop */
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        paddingLeft: 16,
        paddingRight: 16,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={() => setCommandPaletteOpen(false)}
    >
      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          maxWidth: 560,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* ── Search input ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
            style={{ flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command..."
            style={{
              flex: 1,
              padding: '4px 0',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: 15,
              fontFamily: 'var(--font-sans)',
            }}
          />
          <kbd
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '2px 6px',
              fontFamily: 'var(--font-mono)',
              flexShrink: 0,
            }}
          >
            ESC
          </kbd>
        </div>

        {/* ── Results ── */}
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: '4px 0' }}>
          {filtered.length === 0 ? (
            <div
              style={{
                padding: '20px 16px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 13,
              }}
            >
              No commands found
            </div>
          ) : (
            filtered.map((cmd, i) => {
              const active = i === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => cmd.action()}
                  onMouseEnter={() => setSelectedIndex(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 16px',
                    cursor: 'pointer',
                    background: active ? 'var(--surface-hover)' : 'transparent',
                    transition: 'background 80ms',
                  }}
                >
                  <span
                    style={{ fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0 }}
                  >
                    {cmd.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        color: active ? 'var(--text)' : 'var(--text-secondary)',
                        fontWeight: active ? 500 : 400,
                      }}
                    >
                      {cmd.label}
                    </div>
                    {cmd.description && (
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {cmd.description}
                      </div>
                    )}
                  </div>
                  {cmd.shortcut && (
                    <kbd
                      style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: active ? 'var(--bg)' : 'var(--bg)',
                        border: '1px solid var(--border)',
                        fontSize: 11,
                        color: active ? 'var(--text-secondary)' : 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                        flexShrink: 0,
                        marginLeft: 'auto',
                      }}
                    >
                      {cmd.shortcut}
                    </kbd>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer hints ── */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 16,
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
