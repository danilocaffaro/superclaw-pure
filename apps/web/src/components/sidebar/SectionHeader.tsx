'use client';

import { useState } from 'react';

interface SectionHeaderProps {
  title: string;
  count?: number;
  collapsed: boolean;
  onToggle: () => void;
  onAdd?: () => void;
}

export function SectionHeader({ title, count, collapsed, onToggle, onAdd }: SectionHeaderProps) {
  const [hovered, setHovered] = useState(false);
  const [addHovered, setAddHovered] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '5px 16px',
        cursor: 'pointer',
        userSelect: 'none',
        color: hovered ? 'var(--text)' : 'var(--text-secondary)',
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        transition: 'color 150ms',
        gap: 6,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onToggle}
    >
      {/* Chevron */}
      <span
        style={{
          fontSize: 9,
          width: 12,
          textAlign: 'center',
          transition: 'transform 200ms',
          transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
          display: 'inline-block',
          color: 'var(--text-muted)',
        }}
      >
        ▼
      </span>

      {/* Title */}
      <span style={{ flex: 1 }}>{title}</span>

      {/* Badge */}
      {count !== undefined && count > 0 && (
        <span
          style={{
            background: 'var(--surface-hover)',
            color: 'var(--text-secondary)',
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 8,
            fontWeight: 500,
          }}
        >
          {count}
        </span>
      )}

      {/* Add button */}
      {onAdd && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          onMouseEnter={() => setAddHovered(true)}
          onMouseLeave={() => setAddHovered(false)}
          title={`Add ${title.toLowerCase()}`}
          style={{
            width: 22,
            height: 22,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 5,
            fontSize: 14,
            color: addHovered ? 'var(--text)' : 'var(--text-secondary)',
            background: addHovered ? 'var(--surface-hover)' : 'transparent',
            transition: 'all 150ms',
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          +
        </button>
      )}
    </div>
  );
}
