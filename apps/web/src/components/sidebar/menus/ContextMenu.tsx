'use client';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onExport: () => void;
}

export function ContextMenu({ x, y, onClose, onRename, onDelete, onExport }: ContextMenuProps) {
  const menuItems: Array<{ label: string; icon: string; action: () => void; danger?: boolean }> = [
    { label: 'Rename', icon: '✏️', action: onRename },
    { label: 'Export', icon: '📤', action: onExport },
    { label: 'Delete', icon: '🗑️', action: onDelete, danger: true },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 999 }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      {/* Menu */}
      <div
        style={{
          position: 'fixed',
          left: x,
          top: y,
          zIndex: 1000,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '4px 0',
          minWidth: 140,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}
      >
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={(e) => {
              e.stopPropagation();
              item.action();
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '6px 14px',
              fontSize: 13,
              color: item.danger ? 'var(--red, #F85149)' : 'var(--text)',
              transition: 'background 100ms',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hover)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            <span style={{ fontSize: 12 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
