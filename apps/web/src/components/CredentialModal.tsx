'use client';

import { useState, useEffect, useCallback } from 'react';

interface PendingRequest {
  id: string;
  label: string;
  service: string;
  reason: string;
  agentId: string | null;
}

export function CredentialModal() {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [activeRequest, setActiveRequest] = useState<PendingRequest | null>(null);
  const [value, setValue] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [saveToVault, setSaveToVault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Poll for pending requests every 5 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/credentials/requests?status=pending');
        if (res.ok) {
          const data = await res.json() as { data?: PendingRequest[] };
          const pending = data.data ?? [];
          setRequests(pending);
          if (pending.length > 0 && !activeRequest) {
            setActiveRequest(pending[0] ?? null);
          }
        }
      } catch {
        // silent — network errors shouldn't break the UI
      }
    };
    void poll();
    const interval = setInterval(() => void poll(), 5000);
    return () => clearInterval(interval);
  }, [activeRequest]);

  const handleSubmit = useCallback(async () => {
    if (!activeRequest || !value) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/credentials/provide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: activeRequest.id,
          value,
          passphrase: passphrase || 'default-superclaw-key',
          saveToVault,
        }),
      });
      if (res.ok) {
        setValue('');
        setPassphrase('');
        setSaveToVault(false);
        const dismissed = activeRequest;
        setActiveRequest(null);
        setRequests(r => r.filter(req => req.id !== dismissed.id));
      } else {
        const err = await res.json() as { error?: { message?: string } };
        setError(err.error?.message ?? 'Failed to provide credential');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [activeRequest, value, passphrase, saveToVault]);

  const handleCancel = useCallback(async () => {
    if (!activeRequest) return;
    try {
      await fetch(`/api/credentials/requests/${activeRequest.id}/cancel`, {
        method: 'POST',
      });
    } catch {
      // ignore
    }
    const dismissed = activeRequest;
    setActiveRequest(null);
    setRequests(r => r.filter(req => req.id !== dismissed.id));
    setValue('');
    setError('');
  }, [activeRequest]);

  // Keyboard shortcut: Enter to submit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && activeRequest && value && !submitting) {
        void handleSubmit();
      }
      if (e.key === 'Escape' && activeRequest) {
        void handleCancel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeRequest, value, submitting, handleSubmit, handleCancel]);

  if (!activeRequest) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          padding: 24,
          borderRadius: 16,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          margin: '0 16px',
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'rgba(255,107,107,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            🔐
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              Credential Required
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Secure input — never stored in chat
            </div>
          </div>
        </div>

        {/* ── Request info ── */}
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: 'var(--bg)',
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          <div style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>
            {activeRequest.label}
          </div>
          {activeRequest.service && (
            <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>
              Service: {activeRequest.service}
            </div>
          )}
          {activeRequest.reason && (
            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {activeRequest.reason}
            </div>
          )}
        </div>

        {/* ── Secret input ── */}
        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              fontSize: 12,
              color: 'var(--text-secondary)',
              display: 'block',
              marginBottom: 4,
            }}
          >
            Credential
          </label>
          <input
            type="password"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Enter credential..."
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontSize: 14,
              outline: 'none',
              fontFamily: 'var(--font-mono, monospace)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* ── Vault passphrase (only when saving) ── */}
        {saveToVault && (
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: 4,
              }}
            >
              Vault Passphrase (for encryption)
            </label>
            <input
              type="password"
              value={passphrase}
              onChange={e => setPassphrase(e.target.value)}
              placeholder="Master passphrase..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* ── Save to vault toggle ── */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--text-secondary)',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={saveToVault}
            onChange={e => setSaveToVault(e.target.checked)}
            style={{ accentColor: 'var(--green)' }}
          />
          Save to Secure Vault (encrypted, reusable)
        </label>

        {/* ── Security badge ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 16,
            fontSize: 11,
            color: 'var(--yellow)',
          }}
        >
          <span>⚡</span>
          {saveToVault
            ? 'Saved credentials are AES-256-GCM encrypted'
            : 'One-time use — discarded after agent receives it'}
        </div>

        {/* ── Error ── */}
        {error && (
          <div
            style={{
              padding: 8,
              borderRadius: 6,
              background: 'rgba(255,107,107,0.1)',
              color: 'var(--coral)',
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        {/* ── Actions ── */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={() => void handleCancel()}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!value || submitting}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              background: value && !submitting ? 'var(--green)' : 'var(--surface-hover)',
              border: 'none',
              color: value && !submitting ? '#fff' : 'var(--text-muted)',
              cursor: value && !submitting ? 'pointer' : 'default',
              opacity: submitting ? 0.6 : 1,
              transition: 'background 150ms ease',
            }}
          >
            {submitting ? 'Sending...' : 'Provide Securely'}
          </button>
        </div>

        {/* ── Pending count indicator ── */}
        {requests.length > 1 && (
          <div
            style={{
              marginTop: 12,
              textAlign: 'center',
              fontSize: 11,
              color: 'var(--text-muted)',
            }}
          >
            {requests.length - 1} more pending request
            {requests.length - 1 > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
