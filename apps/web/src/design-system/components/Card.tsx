import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';

interface CardProps {
  children:   ReactNode;
  hoverable?: boolean;
  padding?:   'sm' | 'md' | 'lg';
  style?:     CSSProperties;
  onClick?:   () => void;
  // Para marcarla con las clases del estándar del panel (ds-tabla, etc.)
  // cuando la card ES el contenedor de una tabla.
  className?: string;
}

// Tokens y no números: en celular 24px por lado se comían 48px de los 390 y
// toda card se veía angosta y aplastada. Los valores viven en globals.css y
// ahí una media query los baja. Como es el valor por defecto de la prop, un
// `style={{ padding: 0 }}` del que la usa lo sigue pisando (va después).
const paddingMap = {
  sm: 'var(--ds-card-pad-sm)',
  md: 'var(--ds-card-pad-md)',
  lg: 'var(--ds-card-pad-lg)',
};

export function Card({ children, hoverable, padding = 'md', style, onClick, className }: CardProps) {
  const [hovered, setHovered] = useState(false);
  // Una card clickeable siempre da feedback al mouse; hoverable explícito
  // permite forzarlo (o apagarlo) en cards sin onClick propio.
  const isHoverable = hoverable ?? !!onClick;

  return (
    <div
      className={className}
      onClick={onClick}
      onMouseEnter={() => isHoverable && setHovered(true)}
      onMouseLeave={() => isHoverable && setHovered(false)}
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
