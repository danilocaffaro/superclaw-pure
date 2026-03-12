import { create } from 'zustand';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'doing' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedAgentId: string | null;
  sessionId: string | null;
  squadId: string | null;
  tags: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface TaskState {
  tasks: Task[];
  loading: boolean;
  error: string | null;

  fetchTasks: (filters?: { sessionId?: string; squadId?: string; status?: string }) => Promise<void>;
  createTask: (task: Partial<Task> & { title: string }) => Promise<Task>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<Task>;
  moveTask: (id: string, newStatus: Task['status']) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  loading: false,
  error: null,

  fetchTasks: async (filters) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filters?.sessionId) params.set('sessionId', filters.sessionId);
      if (filters?.squadId)   params.set('squadId',   filters.squadId);
      if (filters?.status)    params.set('status',    filters.status);

      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${API_BASE}/tasks${query}`);
      const json = await res.json() as { data?: Task[]; error?: { message: string } };

      if (json.error) throw new Error(json.error.message);
      set({ tasks: json.data ?? [], loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to fetch tasks' });
    }
  },

  createTask: async (task) => {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    const json = await res.json() as { data?: Task; error?: { message: string } };
    if (json.error) throw new Error(json.error.message);
    const created = json.data!;
    set((s) => ({ tasks: [...s.tasks, created] }));
    return created;
  },

  updateTask: async (id, patch) => {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const json = await res.json() as { data?: Task; error?: { message: string } };
    if (json.error) throw new Error(json.error.message);
    const updated = json.data!;
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }));
    return updated;
  },

  moveTask: async (id, newStatus) => {
    const res = await fetch(`${API_BASE}/tasks/${id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    const json = await res.json() as { data?: Task; error?: { message: string } };
    if (json.error) throw new Error(json.error.message);
    const moved = json.data!;
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? moved : t)) }));
    return moved;
  },

  deleteTask: async (id) => {
    const res = await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
    const json = await res.json() as { data?: unknown; error?: { message: string } };
    if (json.error) throw new Error(json.error.message);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
  },
}));
