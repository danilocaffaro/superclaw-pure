'use client';

import React from 'react';

// ─── DebateCard ────────────────────────────────────────────────────────────────

export interface DebateCardProps {
  topic: string;
  status: 'active' | 'resolved' | 'stalemate';
  participants: Array<{
    name: string;
    emoji: string;
    position: string;
    confidence: number;
  }>;
  resolution?: string;
  rounds: number;
}

export function DebateCard({ topic, status, participants, resolution, rounds }: DebateCardProps) {
  const statusConfig = {
    active: { label: 'Active', color: 'var(--blue)', bg: 'var(--blue-subtle)', pulse: true },
    resolved: { label: 'Resolved', color: 'var(--green)', bg: 'var(--green-subtle)', pulse: false },
    stalemate: { label: 'Stalemate', color: 'var(--yellow)', bg: 'var(--yellow-subtle)', pulse: false },
  } as const;

  const cfg = statusConfig[status];

  // Assign bar colors by participant index (for/against/neutral pattern)
  const barColors = ['var(--coral)', 'var(--blue)', 'var(--yellow)'];

  return (
    <div style={{
      background: 'var(--glass-bg)',
      border: '1px solid var(--glass-border)',
      borderRadius: 'var(--radius-lg)',
      padding: '14px 16px',
      marginBottom: 10,
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🗣️</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Agent Debate</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Round {rounds}/3
          </span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '2px 10px', borderRadius: 'var(--radius-sm)',
            background: cfg.bg, color: cfg.color,
            fontSize: 11, fontWeight: 500,
          }}>
            {cfg.pulse && (
              <span className="debate-pulse-dot" style={{
                width: 6, height: 6, borderRadius: '50%',
                background: cfg.color, display: 'inline-block',
              }} />
            )}
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Topic */}
      <p style={{
        fontSize: 13, fontWeight: 600, color: 'var(--text)',
        marginBottom: 14, lineHeight: 1.5,
      }}>
        {topic}
      </p>

      {/* Participants */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {participants.map((p, i) => {
          const barColor = barColors[i % barColors.length];
          return (
            <div key={p.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1.2 }}>{p.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--text)',
                    marginRight: 6,
                  }}>{p.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {p.position}
                  </span>
                </div>
                <span style={{
                  fontSize: 11, color: barColor,
                  fontFamily: 'var(--font-mono)', fontWeight: 600,
                  flexShrink: 0,
                }}>
                  {p.confidence}%
                </span>
              </div>
              {/* Confidence bar */}
              <div style={{
                height: 3, borderRadius: 2,
                background: 'var(--border)',
                marginLeft: 26, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  background: barColor,
                  width: `${p.confidence}%`,
                  transition: 'width 600ms ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Resolution */}
      {resolution && (
        <div style={{
          marginTop: 14,
          borderLeft: '3px solid var(--green)',
          paddingLeft: 10,
          paddingTop: 2, paddingBottom: 2,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)', marginBottom: 3 }}>
            ✓ Resolution
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {resolution}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── WorkflowCard ──────────────────────────────────────────────────────────────

export interface WorkflowCardProps {
  name: string;
  status: 'running' | 'completed' | 'failed';
  steps: Array<{
    label: string;
    status: 'pending' | 'running' | 'done' | 'failed';
    duration?: string;
  }>;
  currentStep: number;
}

export function WorkflowCard({ name, status, steps }: WorkflowCardProps) {
  const statusConfig = {
    running: { label: 'Running', color: 'var(--blue)', bg: 'var(--blue-subtle)' },
    completed: { label: 'Completed', color: 'var(--green)', bg: 'var(--green-subtle)' },
    failed: { label: 'Failed', color: 'var(--coral)', bg: 'var(--coral-subtle)' },
  } as const;

  const cfg = statusConfig[status];

  const stepConfig = {
    pending: { dot: 'var(--text-muted)', line: 'var(--border)', icon: null, pulse: false },
    running: { dot: 'var(--blue)', line: 'var(--blue)', icon: null, pulse: true },
    done: { dot: 'var(--green)', line: 'var(--green)', icon: '✓', pulse: false },
    failed: { dot: 'var(--coral)', line: 'var(--coral)', icon: '✕', pulse: false },
  } as const;

  return (
    <div style={{
      background: 'var(--glass-bg)',
      border: '1px solid var(--glass-border)',
      borderRadius: 'var(--radius-lg)',
      padding: '14px 16px',
      marginBottom: 10,
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Workflow</span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{name}</span>
        </div>
        <span style={{
          padding: '2px 10px', borderRadius: 'var(--radius-sm)',
          background: cfg.bg, color: cfg.color,
          fontSize: 11, fontWeight: 500,
        }}>
          {cfg.label}
        </span>
      </div>

      {/* Timeline */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
        {steps.map((step, i) => {
          const sc = stepConfig[step.status];
          const isLast = i === steps.length - 1;
          return (
            <div key={step.label} style={{ display: 'flex', alignItems: 'flex-start', flex: isLast ? '0 0 auto' : 1, minWidth: 60 }}>
              {/* Step column */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                {/* Dot */}
                <div style={{ position: 'relative', width: 20, height: 20 }}>
                  {sc.pulse && (
                    <div className="workflow-pulse-ring" style={{
                      position: 'absolute', inset: -3,
                      borderRadius: '50%',
                      border: `2px solid ${sc.dot}`,
                    }} />
                  )}
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: sc.dot,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: '#fff', fontWeight: 700,
                    position: 'relative', zIndex: 1,
                  }}>
                    {sc.icon}
                  </div>
                </div>
                {/* Label */}
                <span style={{
                  fontSize: 11, color: step.status === 'pending' ? 'var(--text-muted)' : 'var(--text-secondary)',
                  fontWeight: step.status === 'running' ? 600 : 400,
                  whiteSpace: 'nowrap', textAlign: 'center',
                }}>
                  {step.label}
                </span>
                {/* Duration */}
                {step.duration && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {step.duration}
                  </span>
                )}
              </div>

              {/* Connecting line (not after last) */}
              {!isLast && (
                <div style={{
                  flex: 1, height: 2, marginTop: 9,
                  background: sc.line,
                  minWidth: 12,
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SprintProgressCard ────────────────────────────────────────────────────────

export interface SprintProgressCardProps {
  sprintName: string;
  completed: number;
  total: number;
  tasks: Array<{
    title: string;
    status: 'todo' | 'doing' | 'done';
  }>;
}

export function SprintProgressCard({ sprintName, completed, total, tasks }: SprintProgressCardProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const visibleTasks = tasks.slice(0, 5);

  const dotColor = {
    todo: 'var(--text-muted)',
    doing: 'var(--blue)',
    done: 'var(--green)',
  } as const;

  return (
    <div style={{
      background: 'var(--glass-bg)',
      border: '1px solid var(--glass-border)',
      borderRadius: 'var(--radius-lg)',
      padding: '14px 16px',
      marginBottom: 10,
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>📋</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Sprint Progress</span>
          <span style={{
            padding: '1px 8px', borderRadius: 'var(--radius-sm)',
            background: 'var(--blue-subtle)', color: 'var(--blue)',
            fontSize: 11, fontWeight: 500,
          }}>
            {sprintName}
          </span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          {completed}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{
          height: 6, borderRadius: 3,
          background: 'var(--border)', overflow: 'hidden',
          marginBottom: 4,
        }}>
          <div style={{
            height: '100%', borderRadius: 3,
            background: 'var(--coral)',
            width: `${pct}%`,
            transition: 'width 600ms ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span style={{ color: 'var(--text-muted)' }}>Progress</span>
          <span style={{ color: 'var(--coral)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            {pct}%
          </span>
        </div>
      </div>

      {/* Task mini-list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {visibleTasks.map((task, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: dotColor[task.status],
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 12,
              color: task.status === 'done' ? 'var(--text-muted)' : 'var(--text-secondary)',
              textDecoration: task.status === 'done' ? 'line-through' : 'none',
              lineHeight: 1.4,
            }}>
              {task.title}
            </span>
          </div>
        ))}
        {tasks.length > 5 && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 15 }}>
            +{tasks.length - 5} more
          </span>
        )}
      </div>

      {/* Summary */}
      <div style={{
        fontSize: 11, color: 'var(--text-muted)',
        borderTop: '1px solid var(--border)',
        paddingTop: 8,
      }}>
        {completed}/{total} tasks complete
      </div>
    </div>
  );
}

// ─── Demo / Preview Data ───────────────────────────────────────────────────────

export const DEMO_DEBATE: DebateCardProps = {
  topic: 'Should we use Redis or SQLite for session storage?',
  status: 'resolved',
  participants: [
    {
      name: 'Claw',
      emoji: '⚡',
      position: 'SQLite — simpler, no extra dependency, good enough for single-node',
      confidence: 85,
    },
    {
      name: 'Architect',
      emoji: '🏗️',
      position: 'Redis — better for distributed, pub/sub built-in',
      confidence: 70,
    },
    {
      name: 'Ops',
      emoji: '⚙️',
      position: 'SQLite for MVP, Redis when we need horizontal scaling',
      confidence: 90,
    },
  ],
  resolution: 'Consensus: Start with SQLite (simpler), migrate to Redis when scaling beyond single node.',
  rounds: 2,
};

export const DEMO_WORKFLOW: WorkflowCardProps = {
  name: 'Feature Implementation',
  status: 'running',
  steps: [
    { label: 'Plan', status: 'done', duration: '12s' },
    { label: 'Setup', status: 'done', duration: '8s' },
    { label: 'Implement', status: 'running' },
    { label: 'Test', status: 'pending' },
    { label: 'PR', status: 'pending' },
  ],
  currentStep: 2,
};

export const DEMO_SPRINT: SprintProgressCardProps = {
  sprintName: 'Sprint 2',
  completed: 5,
  total: 8,
  tasks: [
    { title: 'Settings panel', status: 'done' },
    { title: 'Provider API', status: 'done' },
    { title: 'Sidebar upgrade', status: 'done' },
    { title: 'Model selector', status: 'done' },
    { title: 'Mobile responsive', status: 'doing' },
    { title: 'Debate cards', status: 'doing' },
    { title: 'Light theme', status: 'todo' },
    { title: 'Error boundaries', status: 'todo' },
  ],
};
