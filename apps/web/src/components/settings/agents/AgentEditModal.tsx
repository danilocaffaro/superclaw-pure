'use client';

import { useState, useEffect } from 'react';
import type { AgentRow } from './types';

const API = process.env.NEXT_PUBLIC_API_URL ?? '/api';

interface ProviderInfo {
  id: string;
  name: string;
  models: string[];
}

export function AgentEditModal({
  agent,
  onSave,
  onClose,
}: {
  agent: AgentRow;
  onSave: (patch: Partial<AgentRow>) => Promise<void>;
  onClose: () => void;
}) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);

  useEffect(() => {
    fetch(`${API}/config/providers`)
      .then((r) => r.json())
      .then((d) => setProviders(d.data ?? []))
      .catch(() => {});
  }, []);

  const [form, setForm] = useState<Partial<AgentRow>>({
    name: agent.name,
    emoji: agent.emoji,
    role: agent.role,
    systemPrompt: agent.systemPrompt,
    temperature: agent.temperature,
    maxTokens: agent.maxTokens,
    modelPreference: agent.modelPreference,
    providerPreference: agent.providerPreference,
    color: agent.color,
  });
  const [saving, setSaving] = useState(false);
  const upd = <K extends keyof AgentRow>(k: K, v: AgentRow[K]) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        }}
      />
      {/* Modal */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 2001,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 520,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            pointerEvents: 'auto',
            animation: 'slideUp 150ms ease',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 20px', borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 20 }}>{form.emoji}</span>
            <h3 style={{ flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
              Edit Agent
            </h3>
            <button
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: 'var(--radius-md)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >✕</button>
          </div>

          {/* Body */}
          <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
            {/* Emoji + Name row */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 72 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
                  Emoji
                </label>
                <input
                  type="text"
                  value={form.emoji ?? ''}
                  onChange={(e) => upd('emoji', e.target.value as AgentRow['emoji'])}
                  maxLength={4}
                  style={{
                    width: '100%', padding: '7px 10px', textAlign: 'center', fontSize: 20,
                    borderRadius: 'var(--radius-md)', background: 'var(--input-bg)',
                    border: '1px solid var(--border)', color: 'var(--text)', outline: 'none',
                    transition: 'border-color 150ms', boxSizing: 'border-box',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--coral)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
                  Name
                </label>
                <input
                  type="text"
                  value={form.name ?? ''}
                  onChange={(e) => upd('name', e.target.value as AgentRow['name'])}
                  placeholder="Agent name"
                  style={{
                    width: '100%', padding: '7px 10px',
                    borderRadius: 'var(--radius-md)', background: 'var(--input-bg)',
                    border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13,
                    outline: 'none', transition: 'border-color 150ms', boxSizing: 'border-box',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--coral)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                />
              </div>
              <div style={{ width: 90 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
                  Color
                </label>
                <input
                  type="color"
                  value={form.color ?? 'var(--purple, #7c5bf5)'}
                  onChange={(e) => upd('color', e.target.value as AgentRow['color'])}
                  style={{
                    width: '100%', height: 34, padding: '2px 4px',
                    borderRadius: 'var(--radius-md)', background: 'var(--input-bg)',
                    border: '1px solid var(--border)', cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Role */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
                Role
              </label>
              <input
                type="text"
                value={form.role ?? ''}
                onChange={(e) => upd('role', e.target.value as AgentRow['role'])}
                placeholder="e.g. Full-stack developer"
                style={{
                  width: '100%', padding: '7px 10px',
                  borderRadius: 'var(--radius-md)', background: 'var(--input-bg)',
                  border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13,
                  outline: 'none', transition: 'border-color 150ms', boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--coral)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              />
            </div>

            {/* System Prompt */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
                System Prompt
              </label>
              <textarea
                value={form.systemPrompt ?? ''}
                onChange={(e) => upd('systemPrompt', e.target.value as AgentRow['systemPrompt'])}
                rows={5}
                placeholder="Instructions given to this agent..."
                style={{
                  width: '100%', padding: '8px 10px',
                  borderRadius: 'var(--radius-md)', background: 'var(--input-bg)',
                  border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13,
                  lineHeight: 1.5, fontFamily: 'var(--font-sans)', resize: 'vertical',
                  outline: 'none', transition: 'border-color 150ms', boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--coral)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              />
            </div>

            {/* Temperature + MaxTokens row */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
                  Temperature — {form.temperature ?? 0.7}
                </label>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={form.temperature ?? 0.7}
                  onChange={(e) => upd('temperature', parseFloat(e.target.value) as AgentRow['temperature'])}
                  style={{ width: '100%', accentColor: 'var(--coral)', cursor: 'pointer' }}
                />
              </div>
              <div style={{ width: 110 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
                  Max Tokens
                </label>
                <input
                  type="number" min={256} max={200000} step={256}
                  value={form.maxTokens ?? 4096}
                  onChange={(e) => upd('maxTokens', parseInt(e.target.value, 10) as AgentRow['maxTokens'])}
                  style={{
                    width: '100%', padding: '7px 10px',
                    borderRadius: 'var(--radius-md)', background: 'var(--input-bg)',
                    border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13,
                    outline: 'none', fontFamily: 'var(--font-mono)',
                    transition: 'border-color 150ms', boxSizing: 'border-box',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--coral)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                />
              </div>
            </div>

            {/* Provider + Model dropdowns */}
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
                  Provider Preference
                </label>
                <select
                  value={form.providerPreference ?? ''}
                  onChange={(e) => {
                    const newProvider = e.target.value;
                    upd('providerPreference', newProvider as AgentRow['providerPreference']);
                    // Reset model if it doesn't exist in new provider
                    if (newProvider) {
                      const newProviderModels = providers.find((p) => p.id === newProvider)?.models ?? [];
                      if (form.modelPreference && !newProviderModels.includes(form.modelPreference)) {
                        upd('modelPreference', '' as AgentRow['modelPreference']);
                      }
                    } else {
                      upd('modelPreference', '' as AgentRow['modelPreference']);
                    }
                  }}
                  style={{
                    width: '100%', padding: '7px 10px',
                    borderRadius: 'var(--radius-md)', background: 'var(--input-bg)',
                    border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13,
                    outline: 'none', transition: 'border-color 150ms', boxSizing: 'border-box',
                    cursor: 'pointer', appearance: 'auto',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--coral)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <option value="">(Default)</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>
                  Model Preference
                </label>
                {(() => {
                  const availableModels = form.providerPreference
                    ? providers.find((p) => p.id === form.providerPreference)?.models ?? []
                    : providers.flatMap((p) => p.models);
                  return (
                    <select
                      value={form.modelPreference ?? ''}
                      onChange={(e) => upd('modelPreference', e.target.value as AgentRow['modelPreference'])}
                      style={{
                        width: '100%', padding: '7px 10px',
                        borderRadius: 'var(--radius-md)', background: 'var(--input-bg)',
                        border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13,
                        outline: 'none', transition: 'border-color 150ms', boxSizing: 'border-box',
                        cursor: 'pointer', appearance: 'auto',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--coral)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                    >
                      <option value="">(Default)</option>
                      {availableModels.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex', gap: 8, justifyContent: 'flex-end',
            padding: '14px 24px', borderTop: '1px solid var(--border)',
            background: 'var(--glass-bg)', flexShrink: 0,
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 18px', borderRadius: 'var(--radius-md)',
                background: 'var(--surface-hover)', border: '1px solid var(--border)',
                color: 'var(--text)', fontSize: 13, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '8px 18px', borderRadius: 'var(--radius-md)',
                background: saving ? 'var(--surface-hover)' : 'var(--coral)',
                border: 'none', color: saving ? 'var(--text-secondary)' : 'var(--text-on-accent, #fff)',
                fontSize: 13, fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'opacity 150ms',
              }}
              onMouseEnter={(e) => { if (!saving) e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
