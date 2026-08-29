import { ExternalLink } from 'lucide-react'
import type { Descuento } from '../types'

const MONO = '"Geist Mono", "Fira Code", monospace'

function fmt(n: number) {
  return `$ ${Math.round(n).toLocaleString('es-AR')}`
}

interface KpiRowProps { label: string; value: string; sub?: string; accent?: 'error' | 'success' }

function KpiRow({ label, value, sub, accent }: KpiRowProps) {
  const valueColor = accent === 'error' ? 'var(--color-error)' : accent === 'success' ? 'var(--color-success)' : 'var(--color-text)'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '9px 0',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: valueColor, fontFamily: MONO }}>
          {value}
        </span>
        {sub && (
          <p style={{ margin: '1px 0 0', fontSize: 11, color: 'var(--color-muted)', fontFamily: MONO }}>{sub}</p>
        )}
      </div>
    </div>
  )
}

interface Props {
  descuento: Descuento
  onVerMetricas?: () => void
}

export function DetalleRendimiento({ descuento, onVerMetricas }: Props) {
  const { usosConsumidos, limiteUsosTotal } = descuento
  const pct = limiteUsosTotal ? Math.round((usosConsumidos / limiteUsosTotal) * 100) : null

  // Datos mock de revenue — serán reemplazados por useMetricas() en el futuro
  const revSacrificado = usosConsumidos * (descuento.valor || 500)
  const revConDesc = revSacrificado * 4.2
  const ticketPromedio = usosConsumidos > 0 ? Math.round(revConDesc / usosConsumidos) : 0

  return (
    <div
      style={{
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: 20,
      }}
    >
      <p
        style={{
          margin: '0 0 14px',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--color-muted)',
        }}
      >
        Rendimiento
      </p>

      {/* Barra de usos */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Usos</span>
          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: MONO, color: 'var(--color-text)' }}>
            {usosConsumidos.toLocaleString('es-AR')}
            {limiteUsosTotal && (
              <span style={{ fontWeight: 400, color: 'var(--color-muted)' }}>
                {' '}/ {limiteUsosTotal.toLocaleString('es-AR')}
              </span>
            )}
          </span>
        </div>
        {pct !== null && (
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: 'var(--color-surface)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.min(pct, 100)}%`,
                height: '100%',
                borderRadius: 3,
                background: pct >= 90 ? 'var(--color-error)' : pct >= 70 ? 'var(--color-warning)' : 'var(--color-primary)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        )}
        {limiteUsosTotal === null && (
          <div style={{ height: 6, borderRadius: 3, background: 'var(--color-surface)' }}>
            <div
              style={{
                width: `${Math.min((usosConsumidos / 100) * 100, 100)}%`,
                height: '100%',
                borderRadius: 3,
                background: 'var(--color-primary)',
              }}
            />
          </div>
        )}
      </div>

      <KpiRow label="Revenue sacrificado" value={fmt(revSacrificado)} accent="error" />
      <KpiRow label="Revenue c/desc" value={fmt(revConDesc)} accent="success" />
      <KpiRow
        label="Ticket promedio"
        value={ticketPromedio > 0 ? fmt(ticketPromedio) : '-'}
        sub={ticketPromedio > 0 ? 'con descuento' : undefined}
      />

      {onVerMetricas && (
        <button
          type="button"
          className="ds-link"
          onClick={onVerMetricas}
          style={{
            marginTop: 14,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            fontSize: 13,
            color: 'var(--color-primary)',
            fontFamily: 'inherit',
          }}
        >
          <ExternalLink size={13} />
          Ver métricas completas
        </button>
      )}
    </div>
  )
}
