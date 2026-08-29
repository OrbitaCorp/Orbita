import type { InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?:    string;
  error?:    string;
  prefix?:   string;
  trailing?: ReactNode;
  mono?:     boolean;
}

export function Input({ label, error, prefix, trailing, mono, style, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-body)' }}
        >
          {label}
        </label>
      )}

      <div
        // .ds-field (globals.css): borde fuerte al hover + anillo de foco.
        // Con error o disabled el borde inline manda y la clase no aplica.
        className={!error && !props.disabled ? 'ds-field' : undefined}
        style={{
          display:      'flex',
          alignItems:   'center',
          height:       40,
          padding:      '0 12px',
          gap:          6,
          background:   props.disabled ? 'var(--color-surface-alt)' : 'var(--color-surface)',
          border:       `1px solid ${error ? 'var(--color-error)' : 'var(--color-border)'}`,
          borderRadius: 8,
          opacity:      props.disabled ? 0.55 : 1,
          transition:   'border-color 150ms ease, box-shadow 150ms ease',
        }}>
        {prefix && (
          <span style={{
            color:      'var(--color-muted)',
            fontSize:   14,
            fontFamily: mono ? '"Geist Mono", monospace' : 'inherit',
            flexShrink: 0,
          }}>
            {prefix}
          </span>
        )}

        <input
          id={inputId}
          {...props}
          style={{
            flex:       1,
            height:     '100%',
            border:     'none',
            outline:    'none',
            background: 'transparent',
            fontSize:   14,
            color:      'var(--color-text)',
            fontFamily: mono ? '"Geist Mono", monospace' : 'inherit',
            cursor:     props.disabled ? 'not-allowed' : 'text',
            ...style,
          }}
        />

        {trailing && (
          <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            {trailing}
          </span>
        )}
      </div>

      {error && (
        <span style={{ fontSize: 12, color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </span>
      )}
    </div>
  );
}
