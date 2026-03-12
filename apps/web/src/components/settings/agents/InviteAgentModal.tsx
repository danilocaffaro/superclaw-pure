'use client';

import { useState, useEffect, useRef } from 'react';

// ─── Invite Agent Modal ──────────────────────────────────────────────────────
// Flow: POST /gateway/pair → show invite link + curl example → poll status → connected

interface PairData {
  token: string;
  expiresIn: number;
  connectUrl: string;
  inviteUrl: string;
  instructions: string;
}

interface Props {
  onClose: () => void;
  onConnected: () => void;
}

export function InviteAgentModal({ onClose, onConnected }: Props) {
  const [step, setStep] = useState<'generating' | 'waiting' | 'connected' | 'expired' | 'error'>('generating');
  const [pair, setPair] = useState<PairData | null>(null);
  const [connectedAgent, setConnectedAgent] = useState<{ name: string; model: string } | null>(null);
  const [countdown, setCountdown] = useState(600);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generate pairing token on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/gateway/pair', { method: 'POST' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const data = json.data as PairData;
        if (cancelled) return;
        setPair(data);
        setCountdown(data.expiresIn);
        setStep('waiting');
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        setStep('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Poll for connection + countdown
  useEffect(() => {
    if (step !== 'waiting' || !pair) return;

    // Countdown
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setStep('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Poll every 3s
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/gateway/status/${pair.token}`);
        if (!res.ok) {
          if (res.status === 410) setStep('expired');
          return;
        }
        const json = await res.json();
        if (json.data?.status === 'connected') {
          setConnectedAgent({ name: json.data.agentName, model: json.data.agentModel });
          setStep('connected');
        }
      } catch { /* ignore */ }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step, pair]);

  // Cleanup on connected
  useEffect(() => {
    if (step === 'connected' || step === 'expired' || step === 'error') {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [step]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const inviteUrl = pair?.inviteUrl ?? '';
  const curlCmd = pair
    ? `curl -X POST ${pair.connectUrl} \\\n  -H "Content-Type: application/json" \\\n  -d '{"token":"${pair.token}","agentName":"MyAgent","agentModel":"model-id"}'`
    : '';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn 150ms ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: 28, width: 480, maxWidth: '90vw',
        maxHeight: '80vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            🔗 Invite External Agent
          </h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: 18, padding: '0 4px',
          }}>✕</button>
        </div>

        {/* Generating */}
        {step === 'generating' && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
            Generating pairing token…
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>❌</div>
            <div style={{ color: 'var(--coral)', fontSize: 13 }}>{error || 'Failed to generate invite'}</div>
            <button onClick={onClose} style={{
              marginTop: 16, padding: '8px 20px', borderRadius: 'var(--radius-md)',
              background: 'var(--surface-hover)', border: '1px solid var(--border)',
              color: 'var(--text)', cursor: 'pointer', fontSize: 12,
            }}>Close</button>
          </div>
        )}

        {/* Waiting for connection */}
        {step === 'waiting' && pair && (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
              Share this invite link with an external agent. They have <strong>{formatTime(countdown)}</strong> to connect.
            </p>

            {/* Invite URL */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Invite URL
              </label>
              <div style={{
                display: 'flex', gap: 6, alignItems: 'center',
                background: 'var(--surface)', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)', padding: '8px 10px',
              }}>
                <code style={{
                  flex: 1, fontSize: 11, color: 'var(--blue, #58A6FF)',
                  wordBreak: 'break-all', fontFamily: 'var(--font-mono)',
                }}>{inviteUrl}</code>
                <button onClick={() => copyToClipboard(inviteUrl)} style={{
                  padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                  background: copied ? 'var(--green)' : 'var(--coral)',
                  border: 'none', color: '#fff', cursor: 'pointer',
                  fontSize: 10, fontWeight: 600, flexShrink: 0, transition: 'all 150ms',
                }}>
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Curl command */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Or connect via CLI
              </label>
              <pre
                onClick={() => copyToClipboard(curlCmd)}
                style={{
                  background: 'var(--surface)', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)', padding: '10px 12px',
                  fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all', cursor: 'pointer',
                  lineHeight: 1.6, margin: 0,
                }}
                title="Click to copy"
              >{curlCmd}</pre>
            </div>

            {/* Status indicator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', borderRadius: 'var(--radius-md)',
              background: 'color-mix(in srgb, var(--blue, #58A6FF) 6%, transparent)',
              border: '1px solid color-mix(in srgb, var(--blue, #58A6FF) 20%, transparent)',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--blue, #58A6FF)',
                animation: 'pulse 1.5s infinite',
              }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Waiting for agent to connect… ({formatTime(countdown)})
              </span>
            </div>
          </>
        )}

        {/* Expired */}
        {step === 'expired' && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏱</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>Invite expired</div>
            <button onClick={onClose} style={{
              padding: '8px 20px', borderRadius: 'var(--radius-md)',
              background: 'var(--surface-hover)', border: '1px solid var(--border)',
              color: 'var(--text)', cursor: 'pointer', fontSize: 12,
            }}>Close</button>
          </div>
        )}

        {/* Connected! */}
        {step === 'connected' && connectedAgent && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)', marginBottom: 8 }}>
              Agent Connected!
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
              <strong>{connectedAgent.name}</strong>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 20 }}>
              Model: {connectedAgent.model}
            </div>
            <button onClick={onConnected} style={{
              padding: '10px 24px', borderRadius: 'var(--radius-md)',
              background: 'var(--coral)', border: 'none',
              color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            }}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
