import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';

interface CardProps {
  children:   ReactNode;
  hoverable?: boolean;
  padding?:   'sm' | 'md' | 'lg';
  style?:     CSSProperties;
  onClick?:   () => void;
}

const paddingMap = { sm: 16, md: 24, lg: 32 };

export function Card({ children, hoverable = false, padding = 'md', style, onClick }: CardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => hoverable && setHovered(true)}
      onMouseLeave={() => hoverable && setHovered(false)}
      style={{
        background:   'var(--color-surface)',
        border:       `1px solid ${hovered ? 'var(--color-border-strong)' : 'var(--color-border)'}`,
        borderRadius: 12,
        padding:      paddingMap[padding],
        // Tokens del tema (globals.css): en claro son las sombras sutiles de
        // siempre; en oscuro se vuelven profundas con filo de luz arriba.
        boxShadow:    hovered ? 'var(--shadow-card-hover)' : 'var(--shadow-card)',
        transform:    hovered ? 'translateY(-1px)' : 'none',
        transition:   'box-shadow 200ms ease, border-color 150ms ease, transform 200ms ease',
        cursor:       onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
