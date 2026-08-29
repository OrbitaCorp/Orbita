import { useEffect } from 'react'
import { X, ArrowUpRight } from 'lucide-react'
import { BadgeEstado } from './BadgeEstado'
import { useMetricasDetalle } from '../hooks/useMetricasDetalle'
import type { EstadoDescuento } from '../types'

const MONO = '"Geist Mono", "Fira Code", monospace'

function fmt(n: number) {
  return `$ ${Math.round(n).toLocaleString('es-AR')}`
}

interface MiniKpi2Props { label: string; value: string }

function MiniKpi2({ label, value }: MiniKpi2Props) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 10,
        padding: '14px 16px',
      }}
    >
      <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--color-muted)' }}>{label}</p>
      <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--color-text)', fontFamily: MONO }}>
        {value}
      </p>
    </div>
  )
}

interface Props {
  id: string | null
  onClose: () => void
  onNavegar?: (id: string) => void
}

export function MetricasDrawer({ id, onClose, onNavegar }: Props) {
  const { data, isLoading } = useMetricasDetalle(id)

  // Cerrar con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!id) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,.12)',
          zIndex: 199,
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed', right: 0, top: 0, bottom: 0,
          width: 560,
          background: 'var(--color-bg)',
          borderLeft: '1px solid var(--color-border)',
          boxShadow: '0 4px 16px rgba(0,0,0,.12)',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            padding: '22px 24px 18px',
            borderBottom: '1px solid var(--color-border)',
            position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 1,
          }}
        >
          <div>
            {data?.item && (
              <>
                <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  {data.item.entidad === 'cupon' ? 'Cupón' : 'Descuento'}
                </p>
                <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>
                  {data.item.nombre}
                </h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--color-muted)', background: 'var(--color-surface)', padding: '2px 8px', borderRadius: 6 }}>
                    {data.item.tipoLabel}
                  </span>
                  <BadgeEstado estado={data.item.estado as EstadoDescuento} />
                </div>
              </>
            )}
            {isLoading && (
              <p style={{ margin: 0, fontSize: 14, color: 'var(--color-muted)' }}>Cargando…</p>
            )}
          </div>
          <button
            type="button"
            className="ds-hover"
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)', cursor: 'pointer',
            }}
          >
            <X size={15} color="var(--color-muted)" />
          </button>
        </div>

        {data?.item && (
          <div style={{ padding: '20px 24px', flex: 1 }}>
            {/* KPIs 2×2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
              <MiniKpi2 label="Usos" value={data.item.usos.toLocaleString('es-AR')} />
              <MiniKpi2 label="Revenue sacrificado" value={fmt(data.item.revenueSacrificado)} />
              <MiniKpi2 label="Revenue c/desc" value={fmt(data.item.revenueConDesc)} />
              <MiniKpi2 label="Ticket promedio" value={fmt(data.item.ticketPromedio)} />
            </div>

            {/* Usos por día — mini sparkline SVG */}
            {data.usosPorDia.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Usos por día
                </p>
                <SparkLine values={data.usosPorDia} />
              </div>
            )}

            {/* Productos más descontados */}
            <div>
              <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Productos más descontados
              </p>
              <div style={{ background: 'var(--color-surface)', borderRadius: 10, overflow: 'hidden' }}>
                <div
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr auto auto',
                    gap: 12, padding: '8px 14px',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  {['Producto', 'Usos', 'Total desc.'].map((h) => (
                    <span key={h} style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-muted)' }}>{h}</span>
                  ))}
                </div>
                {data.productosDescontados.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr auto auto',
                      gap: 12, padding: '10px 14px',
                      borderBottom: i < data.productosDescontados.length - 1 ? '1px solid var(--color-border)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 13, color: 'var(--color-body)' }}>
                      {p.producto}{' '}
                      <span style={{ color: 'var(--color-muted)' }}>({p.variante})</span>
                    </span>
                    <span style={{ fontSize: 13, fontFamily: MONO }}>{p.veces}</span>
                    <span style={{ fontSize: 13, fontFamily: MONO, color: 'var(--color-error)' }}>{fmt(p.montoDesc)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Botón navegar */}
            {onNavegar && (
              <button
                type="button"
                className="ds-hover"
                onClick={() => onNavegar(data.item.id)}
                style={{
                  marginTop: 24, display: 'inline-flex', alignItems: 'center', gap: 6,
                  height: 36, padding: '0 16px', borderRadius: 8,
                  background: 'var(--color-primary)', border: 'none',
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <ArrowUpRight size={14} />
                Ver detalle completo
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function SparkLine({ values }: { values: number[] }) {
  const W = 510; const H = 50
  const maxV = Math.max(...values, 1)
  const step = W / (values.length - 1)
  const pts = values.map((v, i) => `${i * step},${H - (v / maxV) * H}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', borderRadius: 8, background: 'var(--color-surface)', padding: '4px 0' }}>
      <polyline points={pts} fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
