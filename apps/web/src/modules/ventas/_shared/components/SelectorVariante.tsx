import { useState } from 'react'
import { X } from 'lucide-react'
import { MontoDisplay } from './MontoDisplay'

export interface VarianteOpcion {
  id: string
  talle?: string
  color?: string
  stock: number
  precio?: number
}

interface Props {
  isOpen: boolean
  nombreProducto: string
  precioBase: number
  variantes: VarianteOpcion[]
  onClose: () => void
  onConfirmar: (variante: VarianteOpcion, cantidad: number) => void
}

export function SelectorVariante({
  isOpen,
  nombreProducto,
  precioBase,
  variantes,
  onClose,
  onConfirmar,
}: Props) {
  const [seleccionada, setSeleccionada] = useState<VarianteOpcion | null>(null)
  const [cantidad, setCantidad] = useState(1)

  if (!isOpen) return null

  const talles = [...new Set(variantes.map((v) => v.talle).filter(Boolean))]
  const colores = [...new Set(variantes.map((v) => v.color).filter(Boolean))]
  const tieneDosDimensiones = talles.length > 0 && colores.length > 0

  const getVariante = (talle?: string, color?: string): VarianteOpcion | undefined =>
    variantes.find((v) => (!talle || v.talle === talle) && (!color || v.color === color))

  const handleConfirmar = () => {
    if (!seleccionada) return
    onConfirmar(seleccionada, cantidad)
    setSeleccionada(null)
    setCantidad(1)
  }

  const chipStyle = (activo: boolean, sinStock: boolean) => ({
    padding: '6px 14px',
    borderRadius: 8,
    border: `1px solid ${activo ? 'var(--color-primary)' : 'var(--color-border)'}`,
    background: activo ? 'rgba(59,130,246,.08)' : sinStock ? 'var(--color-surface)' : 'var(--color-bg)',
    color: sinStock ? 'var(--color-muted)' : activo ? 'var(--color-primary)' : 'var(--color-text)',
    cursor: sinStock ? 'not-allowed' : 'pointer',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'inherit',
    opacity: sinStock ? 0.5 : 1,
    transition: 'all 0.1s',
  })

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--color-bg)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, margin: '0 16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>{nombreProducto}</p>
            <MontoDisplay monto={seleccionada?.precio ?? precioBase} size="sm" dim={!seleccionada} />
          </div>
          <button className="ds-hover" onClick={onClose} style={{ background: 'none', border: 'none', borderRadius: 6, color: 'var(--color-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {tieneDosDimensiones ? (
          <>
            {talles.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Talle</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {talles.map((t) => {
                    const v = getVariante(t as string, seleccionada?.color)
                    const sinStock = (v?.stock ?? 0) === 0
                    return (
                      <button key={t} className="ds-hover" data-disabled={sinStock || undefined}
                        style={chipStyle(seleccionada?.talle === t, sinStock)}
                        onClick={() => !sinStock && v && setSeleccionada(v)}>
                        {t}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {colores.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Color</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {colores.map((c) => {
                    const v = getVariante(seleccionada?.talle, c as string)
                    const sinStock = (v?.stock ?? 0) === 0
                    return (
                      <button key={c} className="ds-hover" data-disabled={sinStock || undefined}
                        style={chipStyle(seleccionada?.color === c, sinStock)}
                        onClick={() => !sinStock && v && setSeleccionada(v)}>
                        {c}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {talles.length > 0 ? 'Talle' : 'Color'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {variantes.map((v) => {
                const label = v.talle ?? v.color ?? v.id
                const sinStock = v.stock === 0
                return (
                  <button key={v.id} className="ds-hover" data-disabled={sinStock || undefined}
                    style={chipStyle(seleccionada?.id === v.id, sinStock)}
                    onClick={() => !sinStock && setSeleccionada(v)}>
                    {label} {sinStock && <span style={{ fontSize: 11 }}>(sin stock)</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {seleccionada && (
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--color-muted)' }}>
            Stock disponible: <strong style={{ color: seleccionada.stock > 0 ? 'var(--color-success)' : 'var(--color-error)' }}>{seleccionada.stock}</strong>
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="ds-hover" onClick={() => setCantidad((q) => Math.max(1, q - 1))} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: 16 }}>−</button>
            <span style={{ fontFamily: '"Geist Mono", monospace', fontWeight: 600, fontSize: 16, minWidth: 24, textAlign: 'center' }}>{cantidad}</span>
            <button className="ds-hover" onClick={() => setCantidad((q) => q + 1)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: 16 }}>+</button>
          </div>
          <button
            className="ds-hover"
            onClick={handleConfirmar}
            disabled={!seleccionada}
            style={{ padding: '9px 24px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, fontSize: 14, cursor: seleccionada ? 'pointer' : 'not-allowed', opacity: seleccionada ? 1 : 0.5, fontFamily: 'inherit' }}
          >
            Agregar al ticket
          </button>
        </div>
      </div>
    </div>
  )
}
