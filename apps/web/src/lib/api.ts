const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(
      (err as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`
    );
  }
  return res.json() as Promise<T>;
}

// ─── Health ──────────────────────────────────────────────────

export async function fetchHealth() {
  return apiFetch<{
    status: string;
    version: string;
    engine: string;
    engine: 'native' | 'bridge';
  }>('/healthz');
}

// ─── Sessions ────────────────────────────────────────────────

export async function fetchSessions() {
  return apiFetch<{ data: unknown[] } | unknown[]>('/sessions');
}

export async function fetchSession(id: string) {
  return apiFetch<{ data: unknown }>(`/sessions/${encodeURIComponent(id)}`);
}

export async function fetchMessages(sessionId: string) {
  return apiFetch<{ data: unknown[] } | unknown[]>(
    `/sessions/${encodeURIComponent(sessionId)}/messages`
  );
}

export async function createSession(opts?: { title?: string; agent_id?: string }) {
  return apiFetch<{ data: unknown }>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ title: opts?.title ?? 'New Chat', agent_id: opts?.agent_id ?? '' }),
  });
}

export async function sendMessage(sessionId: string, content: string) {
  return apiFetch<{ data: unknown }>(`/sessions/${encodeURIComponent(sessionId)}/message`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

// ─── Agents ──────────────────────────────────────────────────

export async function fetchAgents() {
  return apiFetch<{ data: unknown[] } | unknown[]>('/agents');
}

export async function createAgent(agent: Record<string, unknown>) {
  return apiFetch<{ data: unknown }>('/agents', {
    method: 'POST',
    body: JSON.stringify(agent),
  });
}

export async function deleteAgent(id: string) {
  return apiFetch<void>(`/agents/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ─── Squads ──────────────────────────────────────────────────

export async function fetchSquads() {
  return apiFetch<{ data: unknown[] } | unknown[]>('/squads');
}

export async function createSquad(squad: Record<string, unknown>) {
  return apiFetch<{ data: unknown }>('/squads', {
    method: 'POST',
    body: JSON.stringify(squad),
  });
}

export async function deleteSquad(id: string) {
  return apiFetch<void>(`/squads/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ─── Models & Config ─────────────────────────────────────────

export async function fetchModels() {
  return apiFetch<{ data: unknown }>('/models');
}
