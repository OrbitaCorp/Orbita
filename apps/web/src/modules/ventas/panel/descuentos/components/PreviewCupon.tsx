import type { TipoCupon, AlcanceDescuento } from '../types'

const MONO = '"Geist Mono", "Fira Code", monospace'

interface Props {
  codigo: string
  nombre: string
  tipo: TipoCupon | null
  valor: string
  alcance: AlcanceDescuento
  montoMinimo?: string
}

export function PreviewCupon({ codigo, nombre, tipo, valor, alcance, montoMinimo }: Props) {
  const descLabel = !tipo
    ? '-'
    : tipo === 'porcentaje'
      ? `${valor || '?'}% OFF`
      : `$${parseFloat(valor || '0').toLocaleString('es-AR')} de descuento`

  const alcanceLabel =
    alcance === 'ticket'
      ? 'Ticket completo'
      : alcance === 'categoria'
        ? 'Categorías seleccionadas'
        : 'Productos seleccionados'

  const minLabel = parseFloat(montoMinimo ?? '0') > 0
    ? `Compra mínima $${parseFloat(montoMinimo ?? '0').toLocaleString('es-AR')}`
    : 'Sin compra mínima'

  return (
    <div
      style={{
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-alt)' }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-muted)' }}>
          Preview cupón
        </p>
      </div>

      {/* Ticket cut visual */}
      <div style={{ padding: '20px 20px 0' }}>
        <div
          style={{
            background: 'var(--color-primary-bg)',
            border: '1px solid rgba(59,130,246,.2)',
            borderRadius: '10px 10px 0 0',
            padding: '16px 20px',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: '0 0 4px', fontSize: 11, color: 'var(--color-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Cupón de descuento
          </p>
          <p
            style={{
              margin: '0 0 8px',
              fontFamily: MONO,
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--color-primary-h)',
              letterSpacing: '0.08em',
            }}
          >
            {codigo || 'PROMO-????'}
          </p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>
            {descLabel}
          </p>
        </div>

        {/* Dashed divider with notches */}
        <div style={{ position: 'relative', height: 0, borderBottom: '1.5px dashed var(--color-border)' }}>
          <div
            style={{
              position: 'absolute', left: -10, top: -9, width: 18, height: 18,
              borderRadius: '50%', background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          />
          <div
            style={{
              position: 'absolute', right: -10, top: -9, width: 18, height: 18,
              borderRadius: '50%', background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          />
        </div>

        <div
          style={{
            background: 'var(--color-surface-alt)',
            borderRadius: '0 0 10px 10px',
            padding: '14px 20px',
          }}
        >
          {nombre && (
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
              {nombre}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Aplica en: {alcanceLabel}</span>
            <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{minLabel}</span>
          </div>
        </div>
      </div>
      <div style={{ height: 20 }} />
    </div>
  )
}
