'use client';

import { useUIStore } from '@/stores/ui-store';
import { useFileStore } from '@/stores/file-store';
import { PanelTabs, CodePanel, PreviewPanel, BrowserPanel, SprintPanel, FlowsPanel, ConsolePanel } from './right-panel';
import MemoryPanel from './MemoryPanel';

const FILE_LANGUAGE_LABELS: Record<string, string> = {
  typescript: 'TypeScript',
  typescriptreact: 'TypeScript React',
  javascript: 'JavaScript',
  javascriptreact: 'JavaScript React',
  json: 'JSON',
  css: 'CSS',
  scss: 'SCSS',
  html: 'HTML',
  markdown: 'Markdown',
  python: 'Python',
  rust: 'Rust',
  go: 'Go',
  yaml: 'YAML',
  bash: 'Bash',
  plaintext: 'Plain Text',
};

interface RightPanelProps {
  mobileOverlay?: boolean;
}

export default function RightPanel({ mobileOverlay = false }: RightPanelProps) {
  const { rightPanelTab, rightPanelCollapsed, setMobileRightPanelOpen } = useUIStore();
  const { selectedFile: fileSelectedPath, fileLanguage } = useFileStore();

  const statusFileName = fileSelectedPath
    ? (fileSelectedPath.split('/').pop() ?? fileSelectedPath)
    : 'No file';
  const statusLangLabel = FILE_LANGUAGE_LABELS[fileLanguage] ?? fileLanguage;

  if (!mobileOverlay && rightPanelCollapsed) return null;

  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'var(--bg)',
        borderLeft: '1px solid var(--border)',
        width: mobileOverlay ? '100%' : 420,
        flexShrink: 0,
        transition: 'all 0.2s ease-in-out',
      }}
    >
      {mobileOverlay && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Panel</span>
          <button
            onClick={() => setMobileRightPanelOpen(false)}
            title="Close panel" aria-label="Close panel"
            style={{
              width: 32, height: 32,
              borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: 'var(--text-secondary)',
              background: 'transparent', border: 'none', cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            ✕
          </button>
        </div>
      )}

      <PanelTabs />
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {rightPanelTab === 'code'    && <CodePanel />}
        {rightPanelTab === 'preview' && <PreviewPanel />}
        {rightPanelTab === 'browser' && <BrowserPanel />}
        {rightPanelTab === 'sprint'  && <SprintPanel />}
        {rightPanelTab === 'flows'   && <FlowsPanel />}
      </div>
      <div style={{
        padding: '4px 12px',
        borderTop: '1px solid var(--border)',
        fontSize: 11,
        color: 'var(--text-muted)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: 'var(--font-mono)',
        flexShrink: 0,
      }}>
        <span>{statusFileName}</span>
        <div style={{ display: 'flex', gap: 12 }}>
          <span>{statusLangLabel}</span>
          <span>UTF-8</span>
          <span>Ln 1, Col 1</span>
        </div>
      </div>
    </aside>
  );
}
