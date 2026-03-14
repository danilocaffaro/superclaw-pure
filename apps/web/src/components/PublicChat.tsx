'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── B054: Public Chat — standalone guest chat page ─────────────────────────
// Accessed via /public/chat/:token (served by server) or #/chat/:token (SPA)
// No login, no sidebar, minimal UI — just a conversation with one agent.

interface ChatInfo {
  title: string;
  agentName: string;
  agentEmoji: string;
  welcomeMessage: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export default function PublicChat({ token }: { token: string }) {
  const [info, setInfo] = useState<ChatInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const guestId = useRef(`guest-${Date.now().toString(36)}`);

  // Load chat info
  useEffect(() => {
    fetch(`/public/chat/${token}`)
      .then(r => { if (!r.ok) throw new Error('Link not found'); return r.json(); })
      .then((d: { data: ChatInfo }) => {
        setInfo(d.data);
        if (d.data.welcomeMessage) {
          setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: d.data.welcomeMessage,
            timestamp: Date.now(),
          }]);
        }
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [token]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch(`/public/chat/${token}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, guestId: guestId.current }),
      });

      if (!res.ok) throw new Error('Failed to send');

      // Read SSE response
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');

      const decoder = new TextDecoder();
      let fullText = '';

      const assistantId = `a-${Date.now()}`;
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '…', timestamp: Date.now() }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6)) as { type: string; text?: string };
            if (data.type === 'content' && data.text) {
              fullText = typeof data.text === 'string' ? data.text : String(data.text);
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m));
            }
          } catch { /* parse error — skip */ }
        }
      }

      // Ensure final state
      if (fullText) {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m));
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: `e-${Date.now()}`, role: 'assistant',
        content: `⚠️ ${(err as Error).message}`, timestamp: Date.now(),
      }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, token]);

  // Error state
  if (error) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Link not found</div>
          <div style={{ fontSize: 14 }}>This chat link may have expired or been disabled.</div>
        </div>
      </div>
    );
  }

  // Loading
  if (loading || !info) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>Loading…</div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid #2a2a2a',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <span style={{ fontSize: 24 }}>{info.agentEmoji}</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{info.title}</div>
          <div style={{ fontSize: 11, color: '#888' }}>Powered by HiveClaw</div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '16px 12px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {messages.map(m => (
          <div key={m.id} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '80%',
            padding: '8px 12px',
            borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
            background: m.role === 'user' ? '#ff6b6b' : '#2a2a2a',
            color: '#fff',
            fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
          }}>
            {m.content}
          </div>
        ))}
        {sending && (
          <div style={{
            alignSelf: 'flex-start', padding: '8px 12px',
            borderRadius: '14px 14px 14px 4px', background: '#2a2a2a',
            color: '#888', fontSize: 14,
          }}>
            <span style={{ animation: 'pulse 1.2s infinite' }}>●</span>
            <span style={{ animation: 'pulse 1.2s infinite 0.2s' }}> ●</span>
            <span style={{ animation: 'pulse 1.2s infinite 0.4s' }}> ●</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 12px', borderTop: '1px solid #2a2a2a',
        display: 'flex', gap: 8, flexShrink: 0,
      }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Type a message…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          disabled={sending}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 20,
            background: '#2a2a2a', border: '1px solid #3a3a3a',
            color: '#fff', fontSize: 14, outline: 'none',
          }}
          autoFocus
        />
        <button
          onClick={sendMessage}
          disabled={sending || !input.trim()}
          style={{
            padding: '10px 16px', borderRadius: 20,
            background: sending || !input.trim() ? '#444' : '#ff6b6b',
            border: 'none', color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: sending ? 'not-allowed' : 'pointer',
          }}
        >
          Send
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column',
  height: '100dvh', width: '100%',
  background: '#1a1a1a', color: '#fff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};
