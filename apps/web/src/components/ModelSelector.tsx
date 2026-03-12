'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useUIStore } from '@/stores/ui-store';

// ─── Model definitions ───────────────────────────────────────────────────────────

interface ModelDef {
  id: string;
  name: string;
  provider: string;
  providerIcon: string;
  providerColor: string;
  contextK: number;
  priceIn?: number;
  priceOut?: number;
  free?: boolean;
}

const MODELS: ModelDef[] = [
  {
    id: 'copilot/claude-opus-4.6',
    name: 'Claude Opus 4.6',
    provider: 'GitHub Copilot',
    providerIcon: '🐙',
    providerColor: 'var(--text-secondary)',
    contextK: 200,
  },
  {
    id: 'copilot/claude-sonnet-4.6',
    name: 'Claude Sonnet 4.6',
    provider: 'GitHub Copilot',
    providerIcon: '🐙',
    providerColor: 'var(--text-secondary)',
    contextK: 200,
  },
  {
    id: 'anthropic/claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    providerIcon: '🟠',
    providerColor: '#D97706',
    contextK: 200,
    priceIn: 3.0,
    priceOut: 15.0,
  },
  {
    id: 'ollama/deepseek-r1-32b',
    name: 'DeepSeek R1 32B',
    provider: 'Ollama (local)',
    providerIcon: '🦙',
    providerColor: 'var(--green)',
    contextK: 128,
    free: true,
  },
  {
    id: 'ollama/qwen3-8b',
    name: 'Qwen3 8B',
    provider: 'Ollama (local)',
    providerIcon: '🦙',
    providerColor: 'var(--green)',
    contextK: 32,
    free: true,
  },
];

// Group by provider
const GROUPED = MODELS.reduce<Record<string, ModelDef[]>>((acc, m) => {
  if (!acc[m.provider]) acc[m.provider] = [];
  acc[m.provider].push(m);
  return acc;
}, {});

// ─── Component ───────────────────────────────────────────────────────────────────

export default function ModelSelector() {
  const { selectedModel, setSelectedModel } = useUIStore();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const currentModel = MODELS.find((m) => m.id === selectedModel) ?? MODELS[0];

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger */}
      <button
        onClick={() => {
          if (!open && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setDropdownStyle({
              position: 'fixed',
              bottom: window.innerHeight - rect.top + 6,
              left: rect.left,
              width: rect.width,
            });
          }
          setOpen((v) => !v);
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 10px',
          borderRadius: 'var(--radius-md)',
          background: open ? 'var(--surface-hover)' : 'var(--input-bg)',
          border: `1px solid ${open ? 'var(--coral)' : 'var(--border)'}`,
          color: 'var(--text)',
          fontSize: 13,
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'all 150ms',
        }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.borderColor = 'var(--border-hover)';
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.borderColor = 'var(--border)';
        }}
      >
        <span style={{ fontSize: 14, flexShrink: 0 }}>{currentModel.providerIcon}</span>
        <span
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 12,
          }}
        >
          {currentModel.name}
        </span>
        <span
          style={{
            color: 'var(--text-secondary)',
            fontSize: 10,
            transition: 'transform 150ms',
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            flexShrink: 0,
          }}
        >
          ▾
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            ...dropdownStyle,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            zIndex: 9999,
            overflow: 'hidden',
            animation: 'dropUp 120ms ease',
          }}
        >
          {Object.entries(GROUPED).map(([provider, models], gi) => (
            <div key={provider}>
              {/* Provider header */}
              <div
                style={{
                  padding: '7px 12px 4px',
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  borderTop: gi > 0 ? '1px solid var(--border)' : 'none',
                }}
              >
                {models[0].providerIcon} {provider}
              </div>

              {/* Model items */}
              {models.map((model) => {
                const isSelected = selectedModel === model.id;
                return (
                  <button
                    key={model.id}
                    onClick={() => {
                      setSelectedModel(model.id);
                      setOpen(false);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      background: isSelected ? 'var(--coral-subtle)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 100ms',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected)
                        (e.currentTarget as HTMLButtonElement).style.background =
                          'var(--surface-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected)
                        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    }}
                  >
                    {/* Selection dot */}
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        border: `2px solid ${isSelected ? 'var(--coral)' : 'var(--border)'}`,
                        background: isSelected ? 'var(--coral)' : 'transparent',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isSelected && (
                        <div
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: '#fff',
                          }}
                        />
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? 'var(--coral)' : 'var(--text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {model.name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                        {model.contextK}K ctx
                      </div>
                    </div>

                    {/* Price badge */}
                    <div style={{ flexShrink: 0 }}>
                      {model.free ? (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: 'var(--green)',
                            background: 'var(--green-subtle)',
                            padding: '1px 5px',
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          FREE
                        </span>
                      ) : model.priceIn ? (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          ${model.priceIn}/M
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Copilot</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes dropUp {
          from { opacity: 0; transform: translateY(6px) }
          to   { opacity: 1; transform: translateY(0) }
        }
      `}</style>
    </div>
  );
}
