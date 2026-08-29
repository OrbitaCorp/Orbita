import type { ComponentType } from 'react';

interface EmptyStateProps {
  icon:        ComponentType<{ size?: number; strokeWidth?: number }>;
  title:       string;
  description: string;
  action?: {
    label:    string;
    onClick:  () => void;
    variant?: 'primary' | 'outline';
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            12,
      padding:        '36px 24px',
      textAlign:      'center',
    }}>
      <div style={{
        width:        56,
        height:       56,
        borderRadius: '50%',
        background:   'var(--color-surface-alt)',
        color:        'var(--color-muted)',
        display:      'grid',
        placeItems:   'center',
      }}>
        <Icon size={26} strokeWidth={1.5} />
      </div>

      <div>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 4px' }}>
          {title}
        </p>
        <p style={{ fontSize: 12, color: 'var(--color-muted)', maxWidth: 260, lineHeight: 1.45, margin: 0 }}>
          {description}
        </p>
      </div>

      {action && (
        <button
          className="ds-hover"
          onClick={action.onClick}
          style={action.variant === 'outline' ? {
            height: 36, padding: '0 14px', borderRadius: 8,
            background: 'transparent', border: '1px solid var(--color-primary)',
            color: 'var(--color-primary)', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
          } : {
            height: 36, padding: '0 14px', borderRadius: 8, border: 'none',
            background: 'var(--color-primary)', color: '#fff',
            fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
