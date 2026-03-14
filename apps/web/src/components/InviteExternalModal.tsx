'use client';

import { useState } from 'react';

interface InviteExternalModalProps {
  open: boolean;
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'var(--font-sans)',
  outline: 'none',
  boxSizing: 'border-box' as const,
};

export default function InviteExternalModal({ open, onClose }: InviteExternalModalProps) {
  const [name, setName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ id: string; callbackUrl: string } | null>(null);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async () => {
    if (!name.trim() || !webhookUrl.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/external-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          webhook_url: webhookUrl.trim(),
          auth_token: token.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const { data } = await res.json();
      setResult({ id: data.id, callbackUrl: data.callback_url ?? `/api/external-agents/${data.id}/callback` });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName(''); setWebhookUrl(''); setToken('');
    setResult(null); setError('');
    onClose();
  };

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 440, padding: 24,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
          🌐 Invite External Agent
        </h3>

        {result ? (
          <div>
            <div style={{ padding: 12, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Agent ID</div>
              <code style={{ fontSize: 12, color: 'var(--coral)', wordBreak: 'break-all' }}>{result.id}</code>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, marginBottom: 4 }}>Callback URL</div>
              <code style={{ fontSize: 12, color: 'var(--coral)', wordBreak: 'break-all' }}>{result.callbackUrl}</code>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Share the callback URL with the external agent. They will POST messages to this endpoint.
            </p>
            <button
              onClick={handleClose}
              style={{
                width: '100%', marginTop: 12, padding: '10px', borderRadius: 8,
                background: 'var(--coral)', color: '#000', fontWeight: 600,
                fontSize: 13, border: 'none', cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Agent Name *
              </label>
              <input
                value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alice (OpenClaw)"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Webhook URL *
              </label>
              <input
                value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Auth Token (optional)
              </label>
              <input
                value={token} onChange={(e) => setToken(e.target.value)}
                placeholder="Bearer token for webhook"
                type="password"
                style={inputStyle}
              />
            </div>
            {error && <div style={{ fontSize: 12, color: 'var(--coral)', padding: '4px 0' }}>{error}</div>}
            <button
              onClick={handleSubmit}
              disabled={loading || !name.trim() || !webhookUrl.trim()}
              style={{
                padding: '10px', borderRadius: 8,
                background: loading ? 'var(--surface-hover)' : 'var(--coral)',
                color: '#000', fontWeight: 600, fontSize: 13,
                border: 'none', cursor: loading ? 'default' : 'pointer',
                opacity: (!name.trim() || !webhookUrl.trim()) ? 0.5 : 1,
              }}
            >
              {loading ? 'Creating…' : 'Create Invite'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
