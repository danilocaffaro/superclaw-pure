'use client';

import { useState, useEffect, useRef } from 'react';

interface ConsoleLine {
  id: number;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

const LEVEL_COLORS: Record<string, string> = {
  info:  'var(--blue)',
  warn:  'var(--yellow)',
  error: 'var(--coral)',
  debug: 'var(--text-muted)',
};

const LEVEL_BG: Record<string, string> = {
  info:  'rgba(88,166,255,0.08)',
  warn:  'rgba(210,153,34,0.08)',
  error: 'rgba(255,107,107,0.08)',
  debug: 'transparent',
};

function ConsolePanel() {
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [connected, setConnected] = useState(false);
  const [sseError, setSseError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/console/stream');

    es.addEventListener('log', (e) => {
      try {
        const line = JSON.parse(e.data) as ConsoleLine;
        setLines(prev => {
          const next = [...prev, line];
          // Keep max 1000 lines in UI
          return next.length > 1000 ? next.slice(-1000) : next;
        });
      } catch { /* ignore parse errors */ }
    });

    es.addEventListener('connected', () => {
      setConnected(true);
      setSseError(false);
    });

    es.onerror = () => {
      setSseError(true);
      setConnected(false);
    };

    es.onopen = () => {
      setConnected(true);
      setSseError(false);
    };

    sseRef.current = es;
    return () => { es.close(); };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // If user scrolled up more than 50px from bottom, disable auto-scroll
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  const clearLogs = async () => {
    try {
      await fetch('/api/console/clear', { method: 'POST' });
      setLines([]);
    } catch { /* ignore */ }
  };

  const filteredLines = filter === 'all'
    ? lines
    : lines.filter(l => l.level === filter);

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return ''; }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 4, padding: '6px 12px',
        borderBottom: '1px solid var(--border)', alignItems: 'center',
        flexShrink: 0,
      }}>
        {/* Level filter chips */}
        {(['all', 'info', 'warn', 'error', 'debug'] as const).map(level => (
          <button key={level} onClick={() => setFilter(level)} style={{
            padding: '2px 8px', borderRadius: 'var(--radius-sm)',
            background: filter === level ? (level === 'all' ? 'var(--surface-hover)' : LEVEL_BG[level]) : 'transparent',
            color: filter === level ? (level === 'all' ? 'var(--text)' : LEVEL_COLORS[level]) : 'var(--text-muted)',
            border: filter === level ? `1px solid ${level === 'all' ? 'var(--border)' : LEVEL_COLORS[level]}33` : '1px solid transparent',
            fontSize: 10, fontWeight: 500, cursor: 'pointer', textTransform: 'uppercase' as const,
          }}>{level}</button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Connection status */}
        <span style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: sseError ? 'var(--coral)' : connected ? 'var(--green)' : 'var(--yellow)',
        }} />

        {/* Line count */}
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {filteredLines.length} lines
        </span>

        {/* Clear button */}
        <button onClick={clearLogs} style={{
          padding: '2px 8px', borderRadius: 'var(--radius-sm)',
          background: 'transparent', border: '1px solid var(--border)',
          color: 'var(--text-muted)', fontSize: 10, cursor: 'pointer',
        }}>Clear</button>
      </div>

      {/* Log output */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1, overflow: 'auto', padding: '4px 0',
          fontFamily: 'var(--font-mono)', fontSize: 11,
          background: 'var(--code-bg, var(--bg))',
        }}
      >
        {filteredLines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>▤</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              {sseError ? 'Connecting to server…' : 'Waiting for log output…'}
            </p>
          </div>
        ) : (
          filteredLines.map(line => (
            <div key={line.id} style={{
              display: 'flex', gap: 8, padding: '1px 12px',
              background: LEVEL_BG[line.level],
              borderLeft: `2px solid ${LEVEL_COLORS[line.level]}`,
            }}>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontSize: 10, lineHeight: '18px' }}>
                {formatTime(line.timestamp)}
              </span>
              <span style={{
                color: LEVEL_COLORS[line.level], flexShrink: 0, width: 36,
                fontSize: 10, fontWeight: 600, textTransform: 'uppercase' as const,
                lineHeight: '18px',
              }}>
                {line.level}
              </span>
              <span style={{
                color: line.level === 'error' ? 'var(--coral)' : 'var(--text-secondary)',
                whiteSpace: 'pre-wrap' as const, wordBreak: 'break-all' as const,
                lineHeight: '18px',
              }}>
                {line.message}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && filteredLines.length > 0 && (
        <button onClick={() => { setAutoScroll(true); if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }} style={{
          position: 'absolute', bottom: 40, right: 20,
          padding: '4px 12px', borderRadius: 12,
          background: 'var(--blue-subtle)', border: '1px solid rgba(88,166,255,0.3)',
          color: 'var(--blue)', fontSize: 10, cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}>
          ↓ Scroll to bottom
        </button>
      )}
    </div>
  );
}

export default ConsolePanel;
