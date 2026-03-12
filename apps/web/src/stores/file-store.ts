import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  children?: FileNode[];
  language?: string;
}

export interface SearchMatch {
  file: string;
  line: number;
  text: string;
}

// ─── State ────────────────────────────────────────────────────────────────────

interface FileState {
  tree: FileNode[];
  selectedFile: string | null;
  fileContent: string;
  fileLanguage: string;
  isLoading: boolean;
  treeLoading: boolean;
  error: string | null;

  // Actions
  fetchTree: (path?: string, depth?: number) => Promise<void>;
  selectFile: (path: string) => Promise<void>;
  searchFiles: (query: string, path?: string, ext?: string) => Promise<SearchMatch[]>;
  clearError: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useFileStore = create<FileState>((set) => ({
  tree: [],
  selectedFile: null,
  fileContent: '',
  fileLanguage: 'typescript',
  isLoading: false,
  treeLoading: false,
  error: null,

  fetchTree: async (path?: string, depth = 4) => {
    set({ treeLoading: true, error: null });
    try {
      const params = new URLSearchParams({ depth: String(depth) });
      if (path) params.set('path', path);
      const res = await fetch(`/api/files/tree?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { data: FileNode[] };
      set({ tree: data.data ?? [], treeLoading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[file-store] fetchTree failed:', msg);
      set({ treeLoading: false, error: msg });
    }
  },

  selectFile: async (path: string) => {
    set({ isLoading: true, selectedFile: path, error: null });
    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as {
        data: { content: string; language: string; size: number; lines: number; path: string };
      };
      set({
        fileContent: data.data.content,
        fileLanguage: data.data.language,
        isLoading: false,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[file-store] selectFile failed:', msg);
      set({ fileContent: `// Error loading file: ${msg}`, isLoading: false, error: msg });
    }
  },

  searchFiles: async (query: string, path?: string, ext?: string) => {
    try {
      const params = new URLSearchParams({ query });
      if (path) params.set('path', path);
      if (ext) params.set('ext', ext);
      const res = await fetch(`/api/files/search?${params.toString()}`);
      if (!res.ok) return [];
      const data = await res.json() as { data: { matches: SearchMatch[] } };
      return data.data?.matches ?? [];
    } catch {
      return [];
    }
  },

  clearError: () => set({ error: null }),
}));
