import { Percent, DollarSign, Receipt, FileText, Timer, Lock } from 'lucide-react'
import { useAddons } from '../hooks/useAddons'
import type { TipoDescuento } from '../types'

interface TipoCard {
  tipo: TipoDescuento
  icono: React.ReactNode
  nombre: string
  desc: string
  // Tarjeta del paquete Avanzado: lleva un chip que dice si está disponible
  // (con el paquete y el interruptor de Avanzado prendido), apagada, o
  // detrás del candado. Se puede elegir igual: la sección de configuración
  // explica qué falta y el formulario no deja guardar hasta entonces.
  avanzado?: boolean
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
  // Oferta relámpago (paquete Avanzado, RBT-675): para la API es un
  // "% Producto" con reloj; para el dueño es un tipo más de promo, y por eso
  // va acá, al lado de los otros, y no como una opción escondida al final.
  { tipo: 'oferta_relampago',    icono: <Timer size={16} strokeWidth={2} />,      nombre: 'Oferta relámpago', desc: 'Un % en productos elegidos que termina a una hora exacta, con reloj en la portada', avanzado: true },
]

interface Props {
  tipo: TipoDescuento | null
  onChange: (tipo: TipoDescuento) => void
  error?: string
}

export function TipoDescuentoSelector({ tipo, onChange, error }: Props) {
  const { data: addons } = useAddons()
  const estadoAvanzado: 'disponible' | 'apagada' | 'candado' | null = !addons
    ? null
    : !addons.advanced ? 'candado' : !addons.flashSaleEnabled ? 'apagada' : 'disponible'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <style>{`
        .tds-chip { display: inline-flex; align-items: center; gap: 4px; height: 18px; padding: 0 7px; border-radius: 999px; font-size: 10px; font-weight: 700; letter-spacing: 0.02em; white-space: nowrap; }
        .tds-chip[data-estado="disponible"] { color: var(--color-warning); background: var(--color-warning-bg); border: 1px solid var(--color-warning); }
        .tds-chip[data-estado="apagada"] { color: var(--color-muted); background: transparent; border: 1px dashed var(--color-border-strong); }
        .tds-chip[data-estado="candado"] { color: var(--color-muted); background: var(--color-surface-alt); border: 1px solid var(--color-border); }
        @media (max-width: 1024px) { .tds-grid { grid-template-columns: repeat(3, minmax(0,1fr)) !important; } }
        @media (max-width: 768px) { .tds-grid { grid-template-columns: minmax(0,1fr) minmax(0,1fr) !important; } }
        @media (max-width: 480px) { .tds-grid { grid-template-columns: minmax(0,1fr) !important; } }
      `}</style>
      <div className="tds-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {CARDS.map((card) => {
          const activo = tipo === card.tipo
          const chip = card.avanzado ? estadoAvanzado : null
          return (
            <button
              key={card.tipo}
              type="button"
              className="ds-hover"
              onClick={() => onChange(card.tipo)}
              aria-pressed={activo}
              style={{
                textAlign: 'left', padding: 16, borderRadius: 10, cursor: 'pointer',
                border: `1.5px solid ${activo ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: activo ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                transition: 'border-color 150ms ease, background 150ms ease',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: activo ? 'var(--color-primary)' : 'var(--color-surface-alt)',
                  color: activo ? '#fff' : card.avanzado ? 'var(--color-warning)' : 'var(--color-body)',
                  transition: 'background 150ms ease, color 150ms ease',
                }}>
                  {card.icono}
                </div>
                {chip && (
                  <span className="tds-chip" data-estado={chip}>
                    {chip === 'candado' && <Lock size={9} strokeWidth={2.4} aria-hidden />}
                    {chip === 'disponible' ? 'Avanzado' : chip === 'apagada' ? 'Apagada' : 'Avanzado'}
                  </span>
                )}
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
