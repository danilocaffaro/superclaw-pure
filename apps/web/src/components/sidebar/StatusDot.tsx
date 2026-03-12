'use client';

export function StatusDot({ status }: { status: string }) {
  const color =
    status === 'online' || status === 'active'
      ? 'var(--green)'
      : status === 'busy'
      ? '#D29922'
      : 'var(--text-muted)';

  return (
    <span
      style={{
        position: 'absolute',
        bottom: -1,
        right: -1,
        width: 9,
        height: 9,
        borderRadius: '50%',
        background: color,
        border: '2px solid var(--surface)',
        flexShrink: 0,
      }}
    />
  );
}
