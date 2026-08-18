import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize    = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?:    ButtonSize;
  loading?: boolean;
  icon?:    ReactNode;
}

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary:   { background: 'var(--color-primary)',     color: 'var(--color-on-primary)', border: 'none' },
  secondary: { background: 'var(--color-surface-alt)', color: 'var(--color-text)',      border: 'none' },
  ghost:     { background: 'transparent',              color: 'var(--color-body)',       border: 'none' },
  danger:    { background: 'var(--color-error)',       color: 'var(--color-on-primary)', border: 'none' },
  outline:   { background: 'transparent',              color: 'var(--color-primary)',    border: '1px solid var(--color-primary)' },
};

const sizeStyles: Record<ButtonSize, CSSProperties> = {
  sm: { height: 32, padding: '0 12px', fontSize: 13 },
  md: { height: 40, padding: '0 16px', fontSize: 14 },
  lg: { height: 48, padding: '0 24px', fontSize: 15, fontWeight: 600 },
};

function Spinner() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      style={{ animation: 'orbita-spin 1s linear infinite' }}>
      <line x1="12" y1="2"  x2="12" y2="6"  />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93"  y1="4.93"  x2="7.76"  y2="7.76"  />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2"  y1="12" x2="6"  y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93"  y1="19.07" x2="7.76"  y2="16.24" />
      <line x1="16.24" y1="7.76"  x2="19.07" y2="4.93"  />
    </svg>
  );
}

export function Button({
  variant  = 'primary',
  size     = 'md',
  loading  = false,
  icon,
  disabled,
  children,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      {...props}
      style={{
        display:      'inline-flex',
        alignItems:   'center',
        gap:          6,
        borderRadius: 8,
        fontFamily:   'inherit',
        fontWeight:   500,
        cursor:       isDisabled ? 'not-allowed' : 'pointer',
        opacity:      isDisabled ? 0.5 : 1,
        transition:   'background 150ms ease, opacity 150ms ease',
        whiteSpace:   'nowrap',
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}
