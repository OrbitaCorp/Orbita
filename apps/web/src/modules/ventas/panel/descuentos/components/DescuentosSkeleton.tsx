import type { CSSProperties } from 'react'

// ─── DescuentosSkeleton ──────────────────────────────────────────────────────
// Piezas de shimmer propias del módulo (equivalente a design-system/Skeleton,
// pero sin importar de `@/design-system/` — prohibido por el CLAUDE.md de este
// módulo). Comparten la clase global `.skel` de styles/globals.css (barrido de
// luz + soporte de modo oscuro/reduced-motion), así que no hace falta ningún
// import adicional para tener el mismo efecto que en pedidos/productos.

const COLS_DESCUENTO = '2fr 1.1fr 1.3fr 1.3fr 0.9fr 0.75fr 1.1fr'
const COLS_CUPON = '1fr 1.4fr 0.9fr 0.65fr 1.1fr 0.75fr 0.65fr 1.1fr'

interface SkProps {
  width?: string | number
  height?: string | number
  radius?: string | number
  delay?: number
  style?: CSSProperties
}

/** Bloque genérico shimmer. Base de todas las piezas de abajo. */
function Sk({ width = '100%', height = 12, radius = 6, delay = 0, style }: SkProps) {
  return (
    <span
      className="skel"
      style={{
        display: 'inline-block', width, height, borderRadius: radius,
        ...(delay ? ({ ['--skel-delay' as string]: `${delay}ms` } as CSSProperties) : {}),
        ...style,
      }}
    />
  )
}

function SkChip({ width = 72, delay = 0 }: { width?: number | string; delay?: number }) {
  return <Sk width={width} height={22} radius={9999} delay={delay} />
}

/**
 * Card con forma de contenido (título + renglones + chip opcional), no un
 * rectángulo plano — insinúa lo que está por llegar, igual que las piezas
 * compartidas de pedidos/productos.
 */
export function SkeletonCard({
  height = 120, delay = 0, lineas = 2, conChip = false,
}: { height?: number; delay?: number; lineas?: number; conChip?: boolean }) {
  const anchos = ['88%', '72%', '80%', '60%']
  return (
    <div
      aria-hidden="true"
      style={{
        height, borderRadius: 12, border: '1px solid var(--color-border)',
        background: 'var(--color-bg)', padding: 18, boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden',
      }}
    >
      <Sk width="38%" height={13} delay={delay} />
      {Array.from({ length: lineas }).map((_, i) => (
        <Sk key={i} width={anchos[i % anchos.length]} height={11} delay={delay + 40 + i * 30} />
      ))}
      {conChip && <SkChip width={78} delay={delay + 40 + lineas * 30} />}
    </div>
  )
}

/** Fila shimmer del listado de descuentos — misma grilla que DescuentosTabla. */
function FilaDescuentoSkeleton({ delay, ultima }: { delay: number; ultima: boolean }) {
  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: COLS_DESCUENTO, gap: 8, padding: '15px 16px',
        alignItems: 'center', borderBottom: ultima ? 'none' : '1px solid var(--color-border)',
      }}
    >
      <Sk width="64%" height={13} delay={delay} />
      <SkChip width={92} delay={delay + 30} />
      <Sk width="70%" height={12} delay={delay + 60} />
      <Sk width="58%" height={12} delay={delay + 90} />
      <SkChip width={68} delay={delay + 120} />
      <Sk width={44} height={12} delay={delay + 150} style={{ marginLeft: 'auto' }} />
      <Sk width={26} height={22} radius={6} delay={delay + 180} style={{ marginLeft: 'auto' }} />
    </div>
  )
}

/** Fila shimmer del listado de cupones — misma grilla que CuponesTabla. */
function FilaCuponSkeleton({ delay, ultima }: { delay: number; ultima: boolean }) {
  return (
    <div
      style={{
        display: 'grid', gridTemplateColumns: COLS_CUPON, gap: 8, padding: '15px 16px',
        alignItems: 'center', borderBottom: ultima ? 'none' : '1px solid var(--color-border)',
      }}
    >
      <Sk width={86} height={13} delay={delay} />
      <Sk width="66%" height={12} delay={delay + 30} />
      <SkChip width={80} delay={delay + 60} />
      <Sk width={52} height={12} delay={delay + 90} style={{ marginLeft: 'auto' }} />
      <Sk width="70%" height={12} delay={delay + 120} />
      <SkChip width={64} delay={delay + 150} style={{ marginLeft: 'auto' }} />
      <Sk width={40} height={12} delay={delay + 180} style={{ marginLeft: 'auto' }} />
      <Sk width={26} height={22} radius={6} delay={delay + 210} style={{ marginLeft: 'auto' }} />
    </div>
  )
}

/** Tabla completa de descuentos mientras carga — header real + filas shimmer, mismo contenedor que la tabla real. */
export function SkeletonTablaDescuentos({ filas = 6 }: { filas?: number }) {
  return (
    <div aria-hidden="true" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ height: 42, background: 'var(--color-surface-alt)', borderBottom: '1px solid var(--color-border)' }} />
      {Array.from({ length: filas }).map((_, i) => (
        <FilaDescuentoSkeleton key={i} delay={i * 90} ultima={i === filas - 1} />
      ))}
    </div>
  )
}

/** Tabla completa de cupones mientras carga. */
export function SkeletonTablaCupones({ filas = 6 }: { filas?: number }) {
  return (
    <div aria-hidden="true" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ height: 42, background: 'var(--color-surface-alt)', borderBottom: '1px solid var(--color-border)' }} />
      {Array.from({ length: filas }).map((_, i) => (
        <FilaCuponSkeleton key={i} delay={i * 90} ultima={i === filas - 1} />
      ))}
    </div>
  )
}

/**
 * Contenido shimmer de los modales "Compartir link" (descuento y cupón) —
 * reemplaza el spinner `Loader2` mientras se pide el detalle completo.
 * `conEstado` agrega el chip de Activo/Inactivo y el bloque de "Enviar por
 * email" que solo tiene el modal de cupones.
 */
export function SkeletonModalLink({ conEstado = false }: { conEstado?: boolean }) {
  return (
    <div aria-hidden="true" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <Sk width={92} height={13} delay={0} style={{ marginBottom: 10 }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Sk height={36} radius={8} delay={40} style={{ flex: 1 }} />
          <Sk width={92} height={36} radius={8} delay={80} />
        </div>
        {conEstado && (
          <div style={{ marginTop: 10 }}>
            <SkChip width={72} delay={120} />
          </div>
        )}
      </div>
      <Sk width="82%" height={11} delay={160} />
      {conEstado && (
        <>
          <div style={{ borderTop: '1px solid var(--color-border)' }} />
          <Sk width={140} height={13} delay={200} />
        </>
      )}
    </div>
  )
}

/** Columna de cards shimmer — para el sidebar de detalle/formularios. */
export function SkeletonColumna({ alturas, lineasBase = 2 }: { alturas: number[]; lineasBase?: number }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {alturas.map((h, i) => (
        <SkeletonCard key={i} height={h} delay={i * 100} lineas={Math.max(1, Math.round(h / 60) + lineasBase - 2)} conChip={i === 0} />
      ))}
    </div>
  )
}
