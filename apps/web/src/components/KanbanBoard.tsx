'use client';

import React, { useState, useEffect, useCallback } from 'react';

// ─── B056: Kanban / Backlog Board ────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'doing' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assigned_agent_id: string | null;
  tags: string; // JSON string
  source_message_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Columns {
  todo: Task[];
  doing: Task[];
  review: Task[];
  done: Task[];
}

const COLUMNS: { id: keyof Columns; label: string; emoji: string; color: string }[] = [
  { id: 'todo',   label: 'Todo',     emoji: '📋', color: '#888' },
  { id: 'doing',  label: 'Doing',    emoji: '⚡', color: '#f59e0b' },
  { id: 'review', label: 'Review',   emoji: '🔍', color: '#6366f1' },
  { id: 'done',   label: 'Done',     emoji: '✅', color: '#22c55e' },
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#f59e0b',
  low:      '#6b7280',
};

export default function KanbanBoard() {
  const [columns, setColumns] = useState<Columns>({ todo: [], doing: [], review: [], done: [] });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<keyof Columns | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<keyof Columns | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/backlog');
      const d = await res.json() as { data: { columns: Columns } };
      setColumns(d.data.columns);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const addTask = async (status: keyof Columns) => {
    if (!newTitle.trim()) return;
    try {
      await fetch('/api/backlog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), status }),
      });
      setNewTitle('');
      setAdding(null);
      await load();
    } catch { /* ignore */ }
  };

  const moveTask = async (taskId: string, newStatus: keyof Columns) => {
    try {
      await fetch(`/api/backlog/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      await load();
    } catch { /* ignore */ }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await fetch(`/api/backlog/${taskId}`, { method: 'DELETE' });
      await load();
    } catch { /* ignore */ }
  };

  const cyclePriority = async (task: Task) => {
    const cycle: Task['priority'][] = ['low', 'medium', 'high', 'critical'];
    const next = cycle[(cycle.indexOf(task.priority) + 1) % cycle.length];
    try {
      await fetch(`/api/backlog/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: next }),
      });
      await load();
    } catch { /* ignore */ }
  };

  // Drag and drop
  const onDragStart = (taskId: string) => setDragging(taskId);
  const onDragEnd = () => { setDragging(null); setDragOver(null); };
  const onDrop = async (colId: keyof Columns) => {
    if (dragging) await moveTask(dragging, colId);
    setDragging(null);
    setDragOver(null);
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading backlog…</div>
  );

  const totalTasks = Object.values(columns).flat().length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>📋</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Backlog</span>
          <span style={{
            padding: '1px 7px', borderRadius: 10, fontSize: 11, fontWeight: 600,
            background: 'var(--surface-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)',
          }}>{totalTasks}</span>
        </div>
        <button
          onClick={() => setAdding('todo')}
          style={{
            padding: '5px 12px', borderRadius: 'var(--radius-md)',
            background: 'var(--coral)', border: 'none', color: '#fff',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          + New Task
        </button>
      </div>

      {/* Kanban columns */}
      <div style={{
        flex: 1, overflowX: 'auto', overflowY: 'hidden',
        display: 'flex', gap: 12, padding: '12px 16px',
      }}>
        {COLUMNS.map(col => {
          const tasks = columns[col.id];
          const isOver = dragOver === col.id;
          return (
            <div
              key={col.id}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
              onDrop={() => onDrop(col.id)}
              onDragLeave={() => { if (dragOver === col.id) setDragOver(null); }}
              style={{
                width: 240, minWidth: 240, display: 'flex', flexDirection: 'column',
                background: isOver ? 'color-mix(in srgb, var(--coral) 4%, var(--surface))' : 'var(--surface)',
                border: `1px solid ${isOver ? 'var(--coral)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                transition: 'border-color 150ms, background 150ms',
              }}
            >
              {/* Column header */}
              <div style={{
                padding: '10px 12px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', borderBottom: '1px solid var(--border)',
                background: 'var(--surface-hover)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14 }}>{col.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: col.color }}>{col.label}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '0 5px', borderRadius: 6,
                    background: `color-mix(in srgb, ${col.color} 12%, transparent)`,
                    color: col.color, minWidth: 18, textAlign: 'center',
                  }}>{tasks.length}</span>
                </div>
                <button
                  onClick={() => { setAdding(col.id); setNewTitle(''); }}
                  style={{
                    width: 22, height: 22, borderRadius: 4, background: 'transparent',
                    border: '1px solid var(--border)', color: 'var(--text-muted)',
                    cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  title={`Add to ${col.label}`}
                >+</button>
              </div>

              {/* Tasks */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Add task inline form */}
                {adding === col.id && (
                  <div style={{
                    padding: 8, borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-hover)', border: '1px solid var(--coral)',
                  }}>
                    <textarea
                      autoFocus
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void addTask(col.id); }
                        if (e.key === 'Escape') { setAdding(null); setNewTitle(''); }
                      }}
                      placeholder="Task title… (Enter to save)"
                      rows={2}
                      style={{
                        width: '100%', background: 'transparent', border: 'none', outline: 'none',
                        color: 'var(--text)', fontSize: 12, resize: 'none', fontFamily: 'var(--font-sans)',
                        lineHeight: 1.4,
                      }}
                    />
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => { setAdding(null); setNewTitle(''); }}
                        style={{
                          padding: '3px 8px', borderRadius: 4, background: 'transparent',
                          border: '1px solid var(--border)', color: 'var(--text-muted)',
                          fontSize: 11, cursor: 'pointer',
                        }}
                      >Cancel</button>
                      <button
                        onClick={() => addTask(col.id)}
                        style={{
                          padding: '3px 8px', borderRadius: 4, background: 'var(--coral)',
                          border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600,
                        }}
                      >Add</button>
                    </div>
                  </div>
                )}

                {tasks.map(task => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => onDragStart(task.id)}
                    onDragEnd={onDragEnd}
                    style={{
                      padding: '8px 10px', borderRadius: 'var(--radius-md)',
                      background: dragging === task.id ? 'var(--coral-subtle)' : 'var(--card-bg)',
                      border: `1px solid ${dragging === task.id ? 'var(--coral)' : 'var(--border)'}`,
                      cursor: 'grab', opacity: dragging === task.id ? 0.5 : 1,
                      transition: 'border-color 100ms',
                      userSelect: 'none',
                    }}
                  >
                    {/* Priority dot + title */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <button
                        onClick={() => cyclePriority(task)}
                        title={`Priority: ${task.priority} (click to cycle)`}
                        style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                          background: PRIORITY_COLORS[task.priority] ?? '#888',
                          border: 'none', cursor: 'pointer', padding: 0,
                        }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.4, flex: 1 }}>
                        {task.title}
                      </span>
                    </div>

                    {/* Description */}
                    {task.description && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.3 }}>
                        {task.description.slice(0, 80)}{task.description.length > 80 ? '…' : ''}
                      </div>
                    )}

                    {/* Footer actions */}
                    <div style={{
                      display: 'flex', gap: 4, marginTop: 6, justifyContent: 'flex-end', flexWrap: 'wrap',
                    }}>
                      {/* Move buttons */}
                      {col.id !== 'todo'   && <MoveBtn label="← Back" onClick={() => moveTask(task.id, COLUMNS[COLUMNS.findIndex(c => c.id === col.id) - 1].id)} />}
                      {col.id !== 'done'   && <MoveBtn label="Next →" onClick={() => moveTask(task.id, COLUMNS[COLUMNS.findIndex(c => c.id === col.id) + 1].id)} primary />}
                      <MoveBtn label="🗑" onClick={() => { if (confirm('Delete task?')) deleteTask(task.id); }} danger />
                    </div>
                  </div>
                ))}

                {tasks.length === 0 && adding !== col.id && (
                  <div style={{
                    padding: '20px 8px', textAlign: 'center', color: 'var(--text-muted)',
                    fontSize: 11, borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--border)',
                  }}>
                    Drop tasks here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MoveBtn({ label, onClick, primary, danger }: {
  label: string; onClick: () => void; primary?: boolean; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 500,
        background: danger ? 'transparent' : primary ? 'var(--coral)' : 'var(--surface-hover)',
        border: `1px solid ${danger ? 'var(--border)' : primary ? 'var(--coral)' : 'var(--border)'}`,
        color: danger ? 'var(--text-muted)' : primary ? '#fff' : 'var(--text-secondary)',
        cursor: 'pointer',
      }}
      onMouseEnter={e => { if (danger) e.currentTarget.style.borderColor = 'var(--coral)'; }}
      onMouseLeave={e => { if (danger) e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      {label}
    </button>
  );
}
