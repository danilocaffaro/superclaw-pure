'use client';
import React from 'react';

interface Props { children: React.ReactNode; fallback?: React.ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console AND expose globally for debugging
    console.error('[ErrorBoundary]', error.message, error.stack);
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__LAST_ERROR__ = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      };
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100%', gap: 16, padding: 32, color: 'var(--text-secondary)'
        }}>
          <span style={{ fontSize: 48 }}>⚠️</span>
          <h2 style={{ color: 'var(--coral)', margin: 0, fontFamily: 'var(--font-sans)' }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', maxWidth: 400, fontFamily: 'var(--font-sans)' }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-md)',
              background: 'var(--coral)', color: 'white', border: 'none',
              cursor: 'pointer', fontSize: 14, fontFamily: 'var(--font-sans)'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
