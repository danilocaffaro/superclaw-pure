'use client';

import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ─── Code Block Component ─────────────────────────────────────────────────────

export const COLLAPSE_THRESHOLD = 50; // lines

export function CodeBlock({ lang, codeString }: { lang: string; codeString: string }) {
  const lineCount = codeString.split('\n').length;
  const isCollapsible = lineCount > COLLAPSE_THRESHOLD;
  const [collapsed, setCollapsed] = useState(isCollapsible); // default collapsed if long
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const displayCode = collapsed
    ? codeString.split('\n').slice(0, COLLAPSE_THRESHOLD).join('\n')
    : codeString;

  return (
    <div style={{
      borderRadius: 'var(--radius-md)', overflow: 'hidden',
      border: '1px solid var(--border)', margin: '8px 0',
      background: 'var(--code-bg)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '5px 12px', background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        fontSize: 11, color: 'var(--text-secondary)',
        fontFamily: 'var(--font-mono)',
      }}>
        {/* Language label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            padding: '1px 7px', borderRadius: 4,
            background: 'var(--surface-hover)', border: '1px solid var(--border)',
            fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)',
            textTransform: 'lowercase', letterSpacing: '0.3px',
          }}>
            {lang || 'code'}
          </span>
          <span style={{ color: 'var(--text-muted)', opacity: 0.6, fontSize: 10 }}>
            {lineCount} line{lineCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isCollapsible && (
            <button
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'Expand code' : 'Collapse code'}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 4,
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 10,
                fontFamily: 'var(--font-mono)', transition: 'all 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--coral)';
                e.currentTarget.style.color = 'var(--coral)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <span style={{ fontSize: 9, lineHeight: 1 }}>{collapsed ? '▼' : '▲'}</span>
              <span>{collapsed ? `Show all ${lineCount} lines` : 'Collapse'}</span>
            </button>
          )}
          <button
            onClick={handleCopy}
            title="Copy code" aria-label="Copy code"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '2px 8px', borderRadius: 4,
              background: copied ? 'rgba(63,185,80,0.1)' : 'transparent',
              border: `1px solid ${copied ? 'rgba(63,185,80,0.4)' : 'var(--border)'}`,
              color: copied ? 'var(--green)' : 'var(--text-muted)',
              cursor: 'pointer', fontSize: 10,
              fontFamily: 'var(--font-mono)', transition: 'all 150ms',
            }}
            onMouseEnter={(e) => {
              if (!copied) {
                e.currentTarget.style.borderColor = 'var(--text-secondary)';
                e.currentTarget.style.color = 'var(--text)';
              }
            }}
            onMouseLeave={(e) => {
              if (!copied) {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }
            }}
          >
            {copied ? '✓ Copied' : '⎘ Copy'}
          </button>
        </div>
      </div>

      {/* Code body */}
      <div style={{ position: 'relative' }}>
        <SyntaxHighlighter
          style={oneDark}
          language={lang || 'text'}
          showLineNumbers={lineCount > 5}
          customStyle={{
            margin: 0,
            padding: '12px',
            background: 'var(--code-bg)',
            fontSize: 13,
            fontFamily: 'var(--font-mono)',
            lineHeight: 1.5,
            borderRadius: 0,
            maxHeight: collapsed ? '680px' : undefined, // ~50 lines × 14px line height
            overflow: collapsed ? 'hidden' : undefined,
          }}
        >
          {displayCode}
        </SyntaxHighlighter>

        {/* Fade-out gradient when collapsed */}
        {collapsed && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 64,
            background: 'linear-gradient(to bottom, transparent, var(--code-bg))',
            pointerEvents: 'none',
          }} />
        )}
      </div>

      {/* Expand footer bar (only when collapsed) */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          style={{
            width: '100%', padding: '8px', border: 'none', borderTop: '1px solid var(--border)',
            background: 'var(--surface)', color: 'var(--text-secondary)',
            fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)',
            transition: 'background 150ms', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 6,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <span style={{ fontSize: 9 }}>▼</span>
          Show {lineCount - COLLAPSE_THRESHOLD} more line{lineCount - COLLAPSE_THRESHOLD !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}

