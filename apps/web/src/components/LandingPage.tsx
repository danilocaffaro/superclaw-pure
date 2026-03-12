'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

// ─── CSS Variables (dark theme, gradient accents) ──────────────────────────────
const vars = {
  '--lp-bg': '#0D1117',
  '--lp-surface': '#161B22',
  '--lp-border': '#30363D',
  '--lp-text': '#E6EDF3',
  '--lp-text-muted': '#8B949E',
  '--lp-accent': 'linear-gradient(135deg, #58A6FF, #BC8CFF)',
  '--lp-accent-start': '#58A6FF',
  '--lp-accent-end': '#BC8CFF',
  '--lp-max-w': '1200px',
} as Record<string, string>;

// ─── Types ─────────────────────────────────────────────────────────────────────
interface LandingPageProps {
  onLaunch: () => void;
}

interface FeatureCard {
  emoji: string;
  title: string;
  desc: string;
}

// ─── Data ──────────────────────────────────────────────────────────────────────
const FEATURES: FeatureCard[] = [
  { emoji: '🤖', title: 'Multi-Agent Teams', desc: 'Create specialized agents, form squads, and orchestrate complex tasks with built-in message passing.' },
  { emoji: '⚡', title: 'Workflow Engine', desc: 'Design and execute multi-step workflows. Sequential processing with real-time SSE progress streaming.' },
  { emoji: '🔀', title: 'Smart Routing', desc: '4-tier provider fallback with per-agent model preferences. Anthropic, OpenAI, and Ollama support.' },
  { emoji: '💬', title: 'Streaming Chat', desc: 'Real-time SSE streaming with markdown, code blocks, and tool execution. Multi-turn conversations preserved.' },
  { emoji: '🔒', title: 'Secure Vault', desc: 'Encrypted credential storage. API keys and secrets managed securely with AES-256 encryption.' },
  { emoji: '📊', title: 'Sprint Dashboard', desc: 'Track development progress, QA scores, and deployment history across your project lifecycle.' },
];

const TECH_STACK = ['TypeScript', 'Fastify', 'Next.js 15', 'SQLite', 'Electron', 'Zustand', 'SSE'];

const STATS = ['28K+ LOC', '25 Tests', '7 Sprints', '20+ DB Tables', '50+ API Endpoints'];

// ─── FadeIn Hook ───────────────────────────────────────────────────────────────
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).style.opacity = '1';
            (entry.target as HTMLElement).style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function FadeSection({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  const ref = useFadeIn();
  return (
    <div
      ref={ref}
      style={{
        opacity: 0,
        transform: 'translateY(24px)',
        transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function LandingPage({ onLaunch }: LandingPageProps) {
  const containerStyle: CSSProperties = {
    ...vars,
    minHeight: '100dvh',
    background: 'var(--lp-bg)',
    color: 'var(--lp-text)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    overflowX: 'hidden',
    scrollBehavior: 'smooth',
  } as CSSProperties;

  const sectionStyle: CSSProperties = {
    maxWidth: 'var(--lp-max-w)',
    margin: '0 auto',
    padding: '0 24px',
  };

  return (
    <div style={containerStyle}>
      {/* ── Hero ── */}
      <FadeSection>
        <section
          style={{
            ...sectionStyle,
            paddingTop: 100,
            paddingBottom: 80,
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(48px, 8vw, 80px)',
              fontWeight: 800,
              background: 'var(--lp-accent)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            } as CSSProperties}
          >
            SuperClaw
          </h1>

          <p
            style={{
              fontSize: 'clamp(18px, 3vw, 24px)',
              color: 'var(--lp-text-muted)',
              marginTop: 16,
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}
          >
            Multi-Agent AI Development Platform
          </p>

          <p
            style={{
              fontSize: 'clamp(15px, 2vw, 18px)',
              color: 'var(--lp-text-muted)',
              maxWidth: 640,
              margin: '20px auto 0',
              lineHeight: 1.6,
              opacity: 0.85,
            }}
          >
            Build, orchestrate, and deploy AI agent teams. Visual workflows,
            real-time streaming, and intelligent model routing — all in one platform.
          </p>

          <div
            style={{
              display: 'flex',
              gap: 16,
              justifyContent: 'center',
              marginTop: 40,
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={onLaunch}
              style={{
                padding: '14px 32px',
                fontSize: 16,
                fontWeight: 600,
                border: 'none',
                borderRadius: 12,
                background: 'var(--lp-accent)',
                color: '#fff',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(88,166,255,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Launch App →
            </button>

            <a
              href="https://github.com/niceclaw/superclaw"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '14px 32px',
                fontSize: 16,
                fontWeight: 600,
                border: '1px solid var(--lp-border)',
                borderRadius: 12,
                background: 'transparent',
                color: 'var(--lp-text)',
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'border-color 0.2s, background 0.2s',
                display: 'inline-flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--lp-accent-start)';
                e.currentTarget.style.background = 'rgba(88,166,255,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--lp-border)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              View on GitHub →
            </a>
          </div>
        </section>
      </FadeSection>

      {/* ── Features Grid ── */}
      <FadeSection>
        <section style={{ ...sectionStyle, paddingBottom: 80 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
              gap: 20,
            }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.title}
                style={{
                  background: 'var(--lp-surface)',
                  border: '1px solid var(--lp-border)',
                  borderRadius: 16,
                  padding: 28,
                  transition: 'border-color 0.2s, transform 0.2s',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--lp-accent-start)';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--lp-border)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span style={{ fontSize: 32 }}>{f.emoji}</span>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    margin: '12px 0 8px',
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: 'var(--lp-text-muted)',
                    margin: 0,
                  }}
                >
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </FadeSection>

      {/* ── Tech Stack ── */}
      <FadeSection>
        <section style={{ ...sectionStyle, paddingBottom: 64, textAlign: 'center' }}>
          <h2
            style={{
              fontSize: 'clamp(22px, 3vw, 28px)',
              fontWeight: 700,
              marginBottom: 28,
            }}
          >
            Tech Stack
          </h2>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              justifyContent: 'center',
            }}
          >
            {TECH_STACK.map((tech) => (
              <span
                key={tech}
                style={{
                  padding: '8px 20px',
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 999,
                  background: 'var(--lp-surface)',
                  border: '1px solid var(--lp-border)',
                  color: 'var(--lp-accent-start)',
                  letterSpacing: '0.01em',
                }}
              >
                {tech}
              </span>
            ))}
          </div>
        </section>
      </FadeSection>

      {/* ── Stats Bar ── */}
      <FadeSection>
        <section
          style={{
            background: 'var(--lp-surface)',
            borderTop: '1px solid var(--lp-border)',
            borderBottom: '1px solid var(--lp-border)',
            padding: '32px 24px',
          }}
        >
          <div
            style={{
              maxWidth: 'var(--lp-max-w)',
              margin: '0 auto',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '12px 32px',
            }}
          >
            {STATS.map((stat, i) => (
              <span
                key={stat}
                style={{
                  fontSize: 'clamp(14px, 2vw, 16px)',
                  fontWeight: 600,
                  color: 'var(--lp-text)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {stat}
                {i < STATS.length - 1 && (
                  <span
                    style={{
                      color: 'var(--lp-text-muted)',
                      opacity: 0.4,
                      marginLeft: 20,
                    }}
                  >
                    •
                  </span>
                )}
              </span>
            ))}
          </div>
        </section>
      </FadeSection>

      {/* ── Footer ── */}
      <footer
        style={{
          textAlign: 'center',
          padding: '48px 24px 40px',
          color: 'var(--lp-text-muted)',
          fontSize: 14,
        }}
      >
        <p style={{ margin: 0 }}>
          Built with ❤️ by SuperClaw Team •{' '}
          <span style={{ color: 'var(--lp-text)' }}>MIT License</span> •{' '}
          <a
            href="https://github.com/niceclaw/superclaw"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--lp-accent-start)', textDecoration: 'none' }}
            onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
            onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
