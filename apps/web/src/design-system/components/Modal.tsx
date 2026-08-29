import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type ModalVariant = 'default' | 'danger' | 'success';

interface ModalProps {
  isOpen:    boolean;
  onClose:   () => void;
  /** false = el click en el fondo y Escape NO cierran: solo la X o un botón
   *  del propio modal. Para decisiones con consecuencias (ej. marcar un
   *  pedido como enviado), donde cerrar sin querer dejaba todo a medias. */
  dismissable?: boolean;
  title:     string;
  children:  ReactNode;
  variant?:  ModalVariant;
  footer?:   ReactNode;
  maxWidth?: number;
}

const variantIcon: Record<ModalVariant, ReactNode> = {
  default: null,
  danger: (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  success: (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
};

const variantColor: Record<ModalVariant, string> = {
  default: 'var(--color-primary)',
  danger:  'var(--color-error)',
  success: 'var(--color-success)',
};

const variantBg: Record<ModalVariant, string> = {
  default: 'var(--color-surface-alt)',
  danger:  'rgba(239,68,68,0.10)',
  success: 'rgba(16,185,129,0.10)',
};

export function Modal({ isOpen, onClose, title, children, variant = 'default', footer, maxWidth = 480, dismissable = true }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && dismissable) onClose(); };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose, dismissable]);

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal
      onClick={() => { if (dismissable) onClose(); }}
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          300,
        background:      'rgba(15,23,42,0.50)',
        backdropFilter:  'blur(2px)',
        display:         'flex',
        alignItems:      'safe center',
        justifyContent:  'center',
        padding:         24,
        overflowY:       'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:        '100%',
          maxWidth:     maxWidth,
          background:   'var(--color-surface)',
          border:       '1px solid var(--color-border)',
          borderRadius: 12,
          boxShadow:    '0 16px 40px rgba(15,23,42,0.20)',
          overflow:     'hidden',
          animation:    'modalIn 200ms ease-out',
        }}
      >
        {/* Header */}
        <header style={{
          padding:       '14px 16px',
          borderBottom:  '1px solid var(--color-border)',
          display:       'flex',
          alignItems:    'center',
          gap:           10,
        }}>
          {variant !== 'default' && (
            <div style={{
              width:        32,
              height:       32,
              borderRadius: 8,
              background:   variantBg[variant],
              color:        variantColor[variant],
              display:      'grid',
              placeItems:   'center',
              flexShrink:   0,
            }}>
              {variantIcon[variant]}
            </div>
          )}

          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
            {title}
          </span>

          <button
            aria-label="Cerrar"
            className="ds-hover"
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6, border: 'none',
              background: 'transparent', color: 'var(--color-muted)',
              display: 'grid', placeItems: 'center',
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {/* Body */}
        <div style={{ padding: 16, fontSize: 13, color: 'var(--color-body)', lineHeight: 1.55 }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <footer style={{
            padding:      '12px 16px',
            borderTop:    '1px solid var(--color-border)',
            display:      'flex',
            gap:          8,
            justifyContent: 'flex-end',
          }}>
            {footer}
          </footer>
        )}
      </div>

      <style>{`@keyframes modalIn { from { opacity:0; transform:scale(0.97); } to { opacity:1; transform:scale(1); } }`}</style>
    </div>,
    document.body,
  );
}
