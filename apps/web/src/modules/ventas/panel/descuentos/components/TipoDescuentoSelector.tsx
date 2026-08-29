import { Percent, DollarSign, Receipt, FileText } from 'lucide-react'
import type { TipoDescuento } from '../types'

interface TipoCard {
  tipo: TipoDescuento
  icono: React.ReactNode
  nombre: string
  desc: string
}

// (CTO, 2026-07-29) Solo los 4 tipos triviales están contemplados en esta etapa —
// el backend los rechaza con 400 (@IsIn de UpsertDiscountDto). Los 3 avanzados
// (lleva_x_paga_y, compra_x_obtiene_z, volumen) no se muestran en este selector;
// sus componentes de configuración (ConfigLlevaXPagaY/ConfigCompraXObtieneZ/
// ConfigVolumen) siguen en el árbol sin tocar, listos para cuando el backend
// los soporte.
const CARDS: TipoCard[] = [
  { tipo: 'porcentaje_producto', icono: <Percent size={16} strokeWidth={2} />,    nombre: '% Producto',      desc: 'Descuento porcentual sobre productos elegidos' },
  { tipo: 'monto_fijo_producto', icono: <DollarSign size={16} strokeWidth={2} />, nombre: '$ Fijo Producto', desc: 'Monto fijo sobre productos elegidos' },
  { tipo: 'porcentaje_ticket',   icono: <Receipt size={16} strokeWidth={2} />,    nombre: '% Ticket',        desc: 'Descuento porcentual sobre el total del ticket' },
  { tipo: 'monto_fijo_ticket',   icono: <FileText size={16} strokeWidth={2} />,   nombre: '$ Fijo Ticket',   desc: 'Monto fijo sobre el total del ticket' },
]

interface Props {
  tipo: TipoDescuento | null
  onChange: (tipo: TipoDescuento) => void
  error?: string
}

export function TipoDescuentoSelector({ tipo, onChange, error }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <style>{`@media (max-width: 768px) { .tds-grid { grid-template-columns: repeat(2, 1fr) !important; } }`}</style>
      <div className="tds-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {CARDS.map((card) => {
          const activo = tipo === card.tipo
          return (
            <button
              key={card.tipo}
              type="button"
              className="ds-hover"
              onClick={() => onChange(card.tipo)}
              style={{
                textAlign: 'left', padding: 16, borderRadius: 10, cursor: 'pointer',
                border: `1.5px solid ${activo ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: activo ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                transition: 'border-color 150ms ease, background 150ms ease',
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 8, marginBottom: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: activo ? 'var(--color-primary)' : 'var(--color-surface-alt)',
                color: activo ? '#fff' : 'var(--color-body)',
                transition: 'background 150ms ease, color 150ms ease',
              }}>
                {card.icono}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: activo ? 'var(--color-primary-h)' : 'var(--color-text)', marginBottom: 2 }}>
                {card.nombre}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-muted)', lineHeight: 1.4 }}>
                {card.desc}
              </div>
            </button>
          )
        })}
      </div>

      {error && <p style={{ margin: 0, fontSize: 12, color: 'var(--color-error)' }}>{error}</p>}
    </div>
  )
}
