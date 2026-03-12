'use client';
import { useEffect, useState } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// ─── PWAProvider ─────────────────────────────────────────────────────────────
export function PWAProvider() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // ── Register service worker ──────────────────────────────────────────────
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[SW] Registered:', reg.scope);
          // Check for updates every 5 minutes
          const timer = setInterval(() => { void reg.update(); }, 5 * 60 * 1000);
          return () => clearInterval(timer);
        })
        .catch((err) => {
          console.warn('[SW] Registration failed:', err);
        });
    }

    // ── Capture install prompt ───────────────────────────────────────────────
    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    // ── Online / offline tracking ────────────────────────────────────────────
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setShowInstall(false);
      setInstallPrompt(null);
    }
  };

  const dismiss = () => setShowInstall(false);

  return (
    <>
      {/* ── Offline banner ────────────────────────────────────────────────── */}
      {!isOnline && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '8px 16px',
            background: 'var(--yellow-subtle)',
            borderBottom: '1px solid var(--yellow)',
            color: 'var(--yellow)',
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--yellow)',
              flexShrink: 0,
            }}
          />
          You are offline — changes will sync when reconnected
        </div>
      )}

      {/* ── Install prompt ────────────────────────────────────────────────── */}
      {showInstall && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 900,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 20px',
            borderRadius: 12,
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: 24 }}>⚡</span>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Install SuperClaw
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              Add to home screen for quick access
            </div>
          </div>
          <button
            onClick={() => { void handleInstall(); }}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--coral)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Install
          </button>
          <button
            onClick={dismiss}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              fontSize: 16,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              lineHeight: 1,
            }}
            aria-label="Dismiss install prompt"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
