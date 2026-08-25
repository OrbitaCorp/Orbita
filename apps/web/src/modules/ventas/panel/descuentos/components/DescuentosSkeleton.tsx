import { Skeleton, SkeletonText, SkeletonChip } from '@/design-system/components/Skeleton'

// ─── DescuentosSkeleton ──────────────────────────────────────────────────────
// Composiciones de shimmer PROPIAS de este módulo (la grilla de columnas de
// sus tablas, el layout de sus modales de link, sus cards de sidebar) armadas
// sobre los primitivos compartidos (Skeleton/SkeletonText/SkeletonChip de
// @/design-system) — mismo criterio que ya usan pedidos/productos para sus
// propias composiciones (SkeletonFilas, SkeletonTarjetas, etc.).
//
// Antes esto reimplementaba sus propios `Sk`/`SkChip` locales porque el
// CLAUDE.md de este módulo decía "no importar de @/design-system, ese path
// no existe" — algo que ya no es cierto (lo usa todo el resto del proyecto,
// storefront incluido). Unificado 2026-08-25 a pedido explícito: un solo
// lugar para mantener el diseño del shimmer en todo el sistema.

const COLS_DESCUENTO = '2fr 1.1fr 1.3fr 1.3fr 0.9fr 0.75fr 1.1fr'
const COLS_CUPON = '1fr 1.4fr 0.9fr 0.65fr 1.1fr 0.75fr 0.65fr 1.1fr'

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
      <SkeletonText width="38%" height={13} delay={delay} />
      {Array.from({ length: lineas }).map((_, i) => (
        <SkeletonText key={i} width={anchos[i % anchos.length]} height={11} delay={delay + 40 + i * 30} />
      ))}
      {conChip && <SkeletonChip width={78} delay={delay + 40 + lineas * 30} />}
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
      <SkeletonText width="64%" height={13} delay={delay} />
      <SkeletonChip width={92} delay={delay + 30} />
      <SkeletonText width="70%" height={12} delay={delay + 60} />
      <SkeletonText width="58%" height={12} delay={delay + 90} />
      <SkeletonChip width={68} delay={delay + 120} />
      <SkeletonText width={44} height={12} delay={delay + 150} style={{ marginLeft: 'auto' }} />
      <Skeleton width={26} height={22} radius={6} delay={delay + 180} style={{ marginLeft: 'auto' }} />
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
      <SkeletonText width={86} height={13} delay={delay} />
      <SkeletonText width="66%" height={12} delay={delay + 30} />
      <SkeletonChip width={80} delay={delay + 60} />
      <SkeletonText width={52} height={12} delay={delay + 90} style={{ marginLeft: 'auto' }} />
      <SkeletonText width="70%" height={12} delay={delay + 120} />
      <SkeletonChip width={64} delay={delay + 150} style={{ marginLeft: 'auto' }} />
      <SkeletonText width={40} height={12} delay={delay + 180} style={{ marginLeft: 'auto' }} />
      <Skeleton width={26} height={22} radius={6} delay={delay + 210} style={{ marginLeft: 'auto' }} />
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
        <SkeletonText width={92} height={13} delay={0} style={{ marginBottom: 10 }} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Skeleton height={36} radius={8} delay={40} style={{ flex: 1 }} />
          <Skeleton width={92} height={36} radius={8} delay={80} />
        </div>
        {conEstado && (
          <div style={{ marginTop: 10 }}>
            <SkeletonChip width={72} delay={120} />
          </div>
        )}
      </div>
      <SkeletonText width="82%" height={11} delay={160} />
      {conEstado && (
        <>
          <div style={{ borderTop: '1px solid var(--color-border)' }} />
          <SkeletonText width={140} height={13} delay={200} />
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
