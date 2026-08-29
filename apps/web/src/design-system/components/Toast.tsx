import type { ReactNode } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  variant:      ToastVariant;
  title:        string;
  description?: string;
  persistent?:  boolean;
  onClose?:     () => void;
}

const variantMap: Record<ToastVariant, { color: string; bg: string; icon: ReactNode }> = {
  success: {
    color: 'var(--color-success)',
    bg:    'rgba(16,185,129,0.10)',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  error: {
    color: 'var(--color-error)',
    bg:    'rgba(239,68,68,0.10)',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  },
  warning: {
    color: 'var(--color-warning)',
    bg:    'rgba(245,158,11,0.10)',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  info: {
    color: 'var(--color-primary)',
    bg:    'rgba(59,130,246,0.10)',
    icon: (
      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
};

export function Toast({ variant, title, description, persistent = false, onClose }: ToastProps) {
  const m = variantMap[variant];

  return (
    <div
      role="alert"
      style={{
        display:      'flex',
        alignItems:   'flex-start',
        gap:          12,
        padding:      '12px 14px',
        background:   'var(--color-surface)',
        border:       '1px solid var(--color-border)',
        borderLeft:   `3px solid ${m.color}`,
        borderRadius: 10,
        boxShadow:    '0 4px 12px rgba(15,23,42,0.08)',
        animation:    'toastIn 300ms cubic-bezier(0.34,1.56,0.64,1)',
        minWidth:     280,
        maxWidth:     380,
      }}
    >
      <div style={{
        width:        30,
        height:       30,
        borderRadius: 8,
        background:   m.bg,
        color:        m.color,
        display:      'grid',
        placeItems:   'center',
        flexShrink:   0,
      }}>
        {m.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: description ? 2 : 0 }}>
          {title}
          {persistent && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
              background: 'var(--color-surface-alt)', color: 'var(--color-muted)',
              marginLeft: 6, fontFamily: '"Geist Mono", monospace', textTransform: 'uppercase',
            }}>
              persistente
            </span>
          )}
        </div>
        {description && (
          <div style={{ fontSize: 12, color: 'var(--color-body)', lineHeight: 1.45 }}>
            {description}
          </div>
        )}
      </div>

      {onClose && (
        <button
          aria-label="Cerrar"
          className="ds-hover"
          onClick={onClose}
          style={{
            width: 24, height: 24, borderRadius: 6, border: 'none',
            background: 'transparent', color: 'var(--color-muted)',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}
        >
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      <style>{`@keyframes toastIn { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }`}</style>
    </div>
  );
}
