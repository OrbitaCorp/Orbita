export type BadgeStatus =
  | 'pendiente'
  | 'confirmado'
  | 'cancelado'
  | 'completado'
  | 'en-proceso'
  | 'enviado'
  | 'preparacion'
  | 'entregado'
  ;

// (Fase 4 — Ale) Antes este componente tenía dos paletas (`light` y `dark`) y
// una prop `dark` para elegir cuál usar... que ningún llamador pasaba nunca.
// Resultado: en modo oscuro TODOS los badges del panel se pintaban con la
// paleta clara — píldoras casi blancas sobre las tarjetas oscuras, en cada
// tabla de pedidos, el dashboard y las fichas de cliente.
//
// Ahora usa los tokens del tema, que se resuelven solos según la clase `dark`
// del <html>. Son los mismos tonos que tenía el mapa de antes, así que el
// look no cambia: lo que cambia es que ahora el modo oscuro funciona.
// El `dot` sigue con su color de acento a propósito: es un punto de color, no
// texto, y ahí el acento se lee bien en los dos temas.

interface BadgeConfig {
  label: string;
  dot:   string;
  bg:    string;
  fg:    string;
}

const config: Record<BadgeStatus, BadgeConfig> = {
  pendiente:    { label: 'Pendiente',  dot: '#F59E0B', bg: 'var(--color-warning-bg)', fg: 'var(--chip-warning-fg)' },
  confirmado:   { label: 'Confirmado', dot: '#10B981', bg: 'var(--color-success-bg)', fg: 'var(--chip-success-fg)' },
  cancelado:    { label: 'Cancelado',  dot: '#EF4444', bg: 'var(--color-error-bg)',   fg: 'var(--chip-error-fg)'   },
  completado:   { label: 'Completado', dot: '#3B82F6', bg: 'var(--color-primary-bg)', fg: 'var(--chip-primary-fg)' },
  'en-proceso': { label: 'En proceso', dot: '#8B5CF6', bg: 'var(--color-violet-bg)',  fg: 'var(--chip-violet-fg)'  },
  enviado:      { label: 'Enviado',    dot: '#3B82F6', bg: 'var(--color-primary-bg)', fg: 'var(--chip-primary-fg)' },
  preparacion:  { label: 'En prep.',   dot: '#8B5CF6', bg: 'var(--color-violet-bg)',  fg: 'var(--chip-violet-fg)'  },
  entregado:    { label: 'Entregado',  dot: '#10B981', bg: 'var(--color-success-bg)', fg: 'var(--chip-success-fg)' },
};

interface BadgeProps {
  status:   BadgeStatus;
  dot?:     boolean;
  size?:    'sm' | 'md';
  label?:   string;
}

export function Badge({ status, dot = true, size = 'md', label }: BadgeProps) {
  const c  = config[status];
  const h  = size === 'sm' ? 20 : 24;
  const px = size === 'sm' ? 8  : 10;
  const fs = size === 'sm' ? 11 : 12;

  return (
    <span style={{
      display:     'inline-flex',
      alignItems:  'center',
      gap:         6,
      height:      h,
      padding:     `0 ${px}px`,
      borderRadius: 9999,
      background:  c.bg,
      color:       c.fg,
      fontSize:    fs,
      fontWeight:  600,
      whiteSpace:  'nowrap',
    }}>
      {dot && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
      )}
      {label ?? c.label}
    </span>
  );
}
