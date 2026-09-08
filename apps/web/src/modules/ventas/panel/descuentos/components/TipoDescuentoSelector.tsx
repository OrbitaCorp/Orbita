import { useRouter } from 'next/router'
import { Percent, DollarSign, Receipt, FileText, Timer, Lock, Check, ArrowRight, Sparkles } from 'lucide-react'
import { useAddons } from '../hooks/useAddons'
import { adminPath, currentSlug } from '@/lib/tenant'
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

// Disponibilidad de la oferta relámpago (paquete Avanzado, RBT-675). La regla
// es "habilitada si el negocio tiene el paquete pagado":
//   - 'candado':    el negocio no pagó el paquete → no se puede elegir; la
//                   tarjeta vende la función y lleva a Suscripción.
//   - 'apagada':    tiene el paquete pero el dueño la apagó desde la tarjeta
//                   de Avanzado (arranca prendida) → tampoco se elige; lleva
//                   a prenderla.
//   - 'disponible': se elige como cualquier otro tipo.
//   - null:         todavía no se sabe (cargando).
export type EstadoRelampago = 'disponible' | 'apagada' | 'candado' | null

export function estadoRelampagoDe(addons: { advanced: boolean; flashSaleEnabled: boolean } | undefined): EstadoRelampago {
  if (!addons) return null
  if (!addons.advanced) return 'candado'
  if (!addons.flashSaleEnabled) return 'apagada'
  return 'disponible'
}

export function TipoDescuentoSelector({ tipo, onChange, error }: Props) {
  const { data: addons } = useAddons()
  const estado = estadoRelampagoDe(addons)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{`
        .tds-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        @media (max-width: 768px) { .tds-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 480px) { .tds-grid { grid-template-columns: minmax(0, 1fr); } }
      `}</style>
      <div className="tds-grid">
        {CARDS.map((card) => {
          const activo = tipo === card.tipo
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

      <TarjetaRelampago estado={estado} activo={tipo === 'oferta_relampago'} onElegir={() => onChange('oferta_relampago')} />

      {error && <p style={{ margin: 0, fontSize: 12, color: 'var(--color-error)' }}>{error}</p>}
    </div>
  )
}

// La oferta relámpago va debajo de los cuatro tipos, a lo ancho y en ámbar:
// es la única del selector que es una función paga, y tiene que leerse como
// tal de un vistazo. Cuando está disponible, la tarjeta entera es el botón
// que la elige; cuando no, la tarjeta cuenta qué hace y el botón lleva a lo
// que falta (pagar el paquete, o prender el interruptor en Avanzado). A
// propósito no se atenúa ni se desenfoca: si no se entiende qué hace, nadie
// la compra.
function TarjetaRelampago({ estado, activo, onElegir }: { estado: EstadoRelampago; activo: boolean; onElegir: () => void }) {
  const router = useRouter()
  const negocioId = currentSlug() ?? (router.query.negocioId as string) ?? 'rama-tienda'
  const moduloPadre = (router.query.moduloPadre as string) ?? 'ventas'
  const irASuscripcion = () => router.push({ pathname: adminPath(negocioId, moduloPadre, 'configuracion'), query: { vista: 'suscripcion' } })
  const irAAvanzado = () => router.push({ pathname: adminPath(negocioId, moduloPadre, 'avanzado') })

  const disponible = estado === 'disponible'
  const cargando = estado === null

  const contenido = (
    <>
      <div className="tdr-icono" aria-hidden="true">
        <Timer size={20} strokeWidth={2} />
      </div>
      <div className="tdr-copy">
        <div className="tdr-titulo">
          <span>Oferta relámpago</span>
          <span className="tdr-chip" data-estado={estado ?? 'cargando'}>
            {estado === 'candado' ? <Lock size={10} strokeWidth={2.4} aria-hidden /> : <Sparkles size={10} strokeWidth={2.4} aria-hidden />}
            Paquete Avanzado
          </span>
        </div>
        <p className="tdr-desc">
          Un descuento que dura poco. Elegís los productos, el porcentaje y hasta qué hora. En tu tienda aparece con un <strong>reloj que cuenta el tiempo que falta</strong>.
        </p>
      </div>
    </>
  )

  if (disponible) {
    return (
      <button
        type="button"
        className="tdr ds-hover"
        data-activo={activo}
        aria-pressed={activo}
        onClick={onElegir}
      >
        <style>{ESTILOS}</style>
        {contenido}
        <span className="tdr-accion" data-activo={activo}>
          {activo ? <><Check size={14} strokeWidth={2.6} aria-hidden /> Elegida</> : <>Elegir <ArrowRight size={14} strokeWidth={2.4} aria-hidden /></>}
        </span>
      </button>
    )
  }

  return (
    <div className="tdr" data-activo={activo} data-bloqueada="true" aria-busy={cargando}>
      <style>{ESTILOS}</style>
      {contenido}
      {!cargando && (
        <button
          type="button"
          className="tdr-accion tdr-accion--cta ds-hover"
          onClick={estado === 'candado' ? irASuscripcion : irAAvanzado}
        >
          {estado === 'candado' ? 'Quiero el paquete Avanzado' : 'Activarla en Avanzado'} <ArrowRight size={14} strokeWidth={2.4} aria-hidden />
        </button>
      )}
    </div>
  )
}

const ESTILOS = `
.tdr {
  display: flex; align-items: center; gap: 14px; width: 100%; text-align: left;
  padding: 14px 16px; border-radius: 12px; cursor: default; font-family: inherit;
  border: 1.5px solid color-mix(in srgb, var(--color-warning) 45%, var(--color-border));
  background: linear-gradient(120deg, color-mix(in srgb, var(--color-warning) 10%, var(--color-bg)) 0%, var(--color-bg) 70%);
  transition: border-color 150ms ease, background 150ms ease, box-shadow 150ms ease;
}
button.tdr { cursor: pointer; }
button.tdr:hover { border-color: var(--color-warning); }
button.tdr:focus-visible { outline: 2px solid var(--color-warning); outline-offset: 2px; }
.tdr[data-activo="true"] {
  border-color: var(--color-warning);
  background: var(--color-warning-bg);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-warning) 18%, transparent);
}
.tdr-icono {
  width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0; display: grid; place-items: center;
  color: var(--color-on-primary, #fff);
  background: linear-gradient(135deg, var(--color-warning), color-mix(in srgb, var(--color-warning) 65%, #000));
}
.tdr-copy { flex: 1; min-width: 0; }
.tdr-titulo { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 14px; font-weight: 700; color: var(--color-text); letter-spacing: -0.01em; }
.tdr-chip {
  display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 8px; border-radius: 999px;
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.02em; white-space: nowrap;
  color: var(--color-warning); background: var(--color-warning-bg); border: 1px solid var(--color-warning);
}
.tdr-chip[data-estado="candado"] { color: var(--color-body); background: var(--color-surface-alt); border-color: var(--color-border-strong); }
.tdr-chip[data-estado="apagada"] { color: var(--color-muted); background: transparent; border-style: dashed; border-color: var(--color-border-strong); }
.tdr-desc { margin: 4px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--color-muted); max-width: 62ch; }
.tdr-desc strong { color: var(--color-body); font-weight: 600; }
.tdr-accion {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px; flex-shrink: 0;
  min-height: 40px; padding: 0 16px; border-radius: 9px; font-size: 13px; font-weight: 600; white-space: nowrap;
  font-family: inherit; border: 1px solid var(--color-warning); color: var(--color-warning); background: transparent;
  transition: background 150ms ease, color 150ms ease;
}
.tdr-accion[data-activo="true"] { background: var(--color-warning); color: var(--color-on-primary, #fff); }
.tdr-accion--cta { cursor: pointer; background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary, #fff); min-height: 44px; }
.tdr-accion--cta:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
@media (max-width: 640px) {
  .tdr { flex-wrap: wrap; padding: 14px; }
  .tdr-copy { flex-basis: calc(100% - 54px); }
  .tdr-accion { width: 100%; margin-top: 4px; min-height: 44px; }
}
`
