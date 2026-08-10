import type { CSSProperties } from 'react';

// ─── Skeleton ────────────────────────────────────────────────────────────────
// Las siluetas que se ven mientras carga una pantalla.
//
// (Fase 3 — Ale, 03/08) Antes cada pantalla dibujaba su propio rectángulo gris
// plano y quieto: se veía como un error de carga, no como algo cargando. Ahora
// todas las piezas comparten la clase `.skel` de globals.css (barrido de luz de
// izquierda a derecha, con su versión para modo oscuro y su corte por
// prefers-reduced-motion), y arman la FORMA de lo que está por llegar: el
// redondel del avatar, dos renglones de texto de largo distinto, la píldora del
// estado, el importe alineado a la derecha.
//
// El `delay` escalona el arranque de cada fila: en vez de que toda la lista
// parpadee al unísono, la luz las recorre de arriba hacia abajo.

interface SkeletonProps {
  width?:    string | number;
  height?:   string | number;
  radius?:   string | number;
  delay?:    number;   // ms de retraso del barrido
  style?:    CSSProperties;
  className?: string;
}

/** Bloque genérico. Es la base de todas las piezas de abajo. */
export function Skeleton({ width = '100%', height = 12, radius = 6, delay = 0, style, className }: SkeletonProps) {
  return (
    <span
      className={`skel${className ? ' ' + className : ''}`}
      style={{
        width,
        height,
        borderRadius: radius,
        ...(delay ? ({ ['--skel-delay' as string]: `${delay}ms` } as CSSProperties) : {}),
        ...style,
      }}
    />
  );
}

/** Renglón de texto. */
export function SkeletonText({ width = '100%', height = 12, delay = 0, style }: SkeletonProps) {
  return <Skeleton width={width} height={height} radius={5} delay={delay} style={style} />;
}

/** Redondel: avatar, ícono. */
export function SkeletonCircle({ size = 34, delay = 0, style }: { size?: number; delay?: number; style?: CSSProperties }) {
  return <Skeleton width={size} height={size} radius="50%" delay={delay} style={style} />;
}

/** Píldora: badge de estado, chip. */
export function SkeletonChip({ width = 76, delay = 0, style }: { width?: number | string; delay?: number; style?: CSSProperties }) {
  return <Skeleton width={width} height={22} radius={9999} delay={delay} style={style} />;
}

// ─── Composiciones listas para usar ─────────────────────────────────────────

/**
 * Filas de una tabla de listado (pedidos, clientes, notas): avatar + nombre y
 * su renglón chico + estado + importe. Los anchos alternan un poco por fila
 * para que no se vea un patrón repetido y artificial.
 */
export function SkeletonFilas({ filas = 6, conAvatar = true }: { filas?: number; conAvatar?: boolean }) {
  const anchos = ['58%', '42%', '68%', '50%', '62%', '46%'];
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column' }}>
      {Array.from({ length: filas }).map((_, i) => {
        const d = i * 90;
        return (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '0 16px', height: 56,
              borderBottom: i < filas - 1 ? '1px solid var(--color-border)' : 'none',
            }}
          >
            {conAvatar && <SkeletonCircle size={32} delay={d} />}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
              <SkeletonText width={anchos[i % anchos.length]} height={12} delay={d} />
              <SkeletonText width="30%" height={9} delay={d + 40} />
            </div>
            <SkeletonChip width={72} delay={d + 80} />
            <SkeletonText width={64} height={13} delay={d + 120} style={{ borderRadius: 5 }} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Tarjetas de listado (devoluciones): encabezado con número y estado, la línea
 * del cliente, el recuadro del producto y la botonera.
 */
export function SkeletonTarjetas({ tarjetas = 3 }: { tarjetas?: number }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: tarjetas }).map((_, i) => {
        const d = i * 110;
        return (
          <div
            key={i}
            style={{
              background: 'var(--color-bg)', border: '1px solid var(--color-border)',
              borderRadius: 12, padding: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <SkeletonText width={92} height={14} delay={d} />
              <SkeletonChip width={78} delay={d + 40} />
              <SkeletonText width={46} height={10} delay={d + 60} />
              <span style={{ flex: 1 }} />
              <SkeletonText width={96} height={10} delay={d + 80} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <SkeletonCircle size={32} delay={d + 40} />
              <SkeletonText width={132} height={12} delay={d + 60} />
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: 12,
              background: 'var(--color-surface)', borderRadius: 8, marginBottom: 14,
            }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <SkeletonText width="45%" height={12} delay={d + 100} />
                <SkeletonText width="28%" height={9} delay={d + 130} />
              </div>
              <SkeletonChip width={104} delay={d + 150} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Skeleton width={92} height={30} radius={8} delay={d + 170} />
              <Skeleton width={78} height={30} radius={8} delay={d + 190} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Fila de tarjetas de métrica (los KPI de arriba de cada pantalla). */
export function SkeletonKpis({ cantidad = 4 }: { cantidad?: number }) {
  return (
    <>
      {Array.from({ length: cantidad }).map((_, i) => {
        const d = i * 90;
        return (
          <div
            key={i}
            style={{
              background: 'var(--color-bg)', border: '1px solid var(--color-border)',
              borderRadius: 12, padding: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <SkeletonText width={84} height={10} delay={d} />
              <Skeleton width={32} height={32} radius={8} delay={d + 40} />
            </div>
            <SkeletonText width="62%" height={26} delay={d + 60} style={{ marginBottom: 12, borderRadius: 6 }} />
            <SkeletonChip width={62} delay={d + 100} />
          </div>
        );
      })}
    </>
  );
}
