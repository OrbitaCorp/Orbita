// Sección "Cuenta regresiva en la tienda" del formulario de descuento
// (funcionalidad del paquete Avanzado, RBT-675).
//
// Es UN interruptor. Nada de título, fecha ni textos propios: el reloj usa el
// nombre del descuento, cuenta hasta su fecha de fin y muestra sus productos
// con el precio ya rebajado. Reemplazó a una tarjeta aparte arriba del listado
// y a una pantalla propia en Avanzado con su formulario: el dueño buscaba esto
// adentro del descuento, y eran dos formularios para una sola promo.
//
// Cuatro estados:
//   - SIN el paquete: se ve entera y legible, con el candado y "Ver qué
//     incluye" — a propósito no gris ni borrosa (si no se entiende qué hace,
//     nadie la compra). El gate real vive en el backend.
//   - CON el paquete pero sin fecha de fin: el interruptor se traba y dice por
//     qué. La validación del formulario lo repite al guardar.
//   - CON el paquete y fecha: el interruptor manda.
//   - CON el paquete, prendida, pero la fecha de fin ya pasó (un descuento
//     vencido que se abre para editar): el interruptor queda como está —la
//     fila sigue apuntando a este descuento— y debajo avisa que la portada ya
//     no la muestra y que hay que correr la fecha. Guardar así lo frena la
//     validación del formulario, igual que el backend.

import { useRouter } from 'next/router'
import { ArrowRight, Lock, Timer } from 'lucide-react'
import { SectionCard } from './FormField'
import { Toggle } from '../../../_shared/components'
import { useAddons } from '../hooks/useAddons'
import { adminPath, currentSlug } from '@/lib/tenant'
import { hoyISO, isoADisplay } from '../utils'

interface Props {
  on: boolean
  onChange: (on: boolean) => void
  sinVencimiento: boolean
  fechaFin: string
}

export function CountdownSection({ on, onChange, sinVencimiento, fechaFin }: Props) {
  const router = useRouter()
  const { data: addons, isLoading } = useAddons()
  const avanzado = addons?.advanced ?? false
  const sinFecha = sinVencimiento || !fechaFin
  // Mismo criterio que la validación del reducer: "<= hoy" porque el backend
  // guarda la fecha de fin como medianoche UTC de ese día.
  const vencida = !sinFecha && fechaFin <= hoyISO()

  function irASuscripcion() {
    const negocioId = currentSlug() ?? (router.query.negocioId as string) ?? 'rama-tienda'
    const moduloPadre = (router.query.moduloPadre as string) ?? 'ventas'
    router.push({ pathname: adminPath(negocioId, moduloPadre, 'configuracion'), query: { vista: 'suscripcion' } })
  }

  const bloqueada = !isLoading && !avanzado
  const trabada = isLoading || bloqueada || sinFecha

  return (
    <SectionCard id="descuento-seccion-countdown" title="Cuenta regresiva en la tienda">
      <style>{`
        .dcs-fila { display: flex; align-items: flex-start; gap: 12px; }
        .dcs-fila > span:first-child { margin-top: 2px; }
        .dcs-copy { flex: 1; min-width: 0; }
        .dcs-titulo { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 14px; font-weight: 600; color: var(--color-text); }
        .dcs-desc { margin: 4px 0 0; font-size: 13px; line-height: 1.55; color: var(--color-muted); max-width: 64ch; }
        .dcs-nota { margin: 8px 0 0; font-size: 12.5px; line-height: 1.5; color: var(--color-body); }
        .dcs-nota[data-tipo="aviso"] { color: var(--color-warning); }
        .dcs-chip {
          display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 9px; border-radius: 999px;
          font-size: 11px; font-weight: 600; color: var(--color-warning); background: var(--color-warning-bg); border: 1px solid var(--color-warning);
        }
        .dcs-cta {
          display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; height: 36px; padding: 0 14px; border-radius: 8px;
          font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; border: none;
          background: var(--color-primary); color: var(--color-on-primary);
        }
        .dcs-cta:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
      `}</style>

      <div className="dcs-fila">
        <Toggle checked={on && !trabada} onChange={onChange} disabled={trabada} />
        <div className="dcs-copy">
          <div className="dcs-titulo">
            <Timer size={15} strokeWidth={2} color="var(--color-warning)" aria-hidden />
            Mostrar este descuento con cuenta regresiva en la portada
            {bloqueada && (
              <span className="dcs-chip">
                <Lock size={11} strokeWidth={2.2} aria-hidden />
                Solo con el paquete Avanzado
              </span>
            )}
          </div>
          <p className="dcs-desc">
            Un reloj con los días, las horas y los minutos que faltan para que venza, y sus productos con el precio ya rebajado. Se apaga solo cuando vence. Solo un descuento a la vez puede tenerla: si otro la tenía, pasa a este.
          </p>

          {!bloqueada && !isLoading && sinFecha && (
            <p className="dcs-nota" data-tipo="aviso">Para mostrarla, poné una fecha de fin en Vigencia.</p>
          )}
          {!bloqueada && !sinFecha && on && vencida && (
            <p className="dcs-nota" data-tipo="aviso">
              Venció el <strong>{isoADisplay(fechaFin) || fechaFin}</strong> y la portada ya no la muestra. Corré la fecha de fin en Vigencia para volver a mostrarla.
            </p>
          )}
          {!bloqueada && !sinFecha && on && !vencida && (
            <p className="dcs-nota">Cuenta hasta el <strong>{isoADisplay(fechaFin) || fechaFin}</strong>, la misma fecha en que deja de descontar.</p>
          )}

          {bloqueada && (
            <button type="button" className="dcs-cta ds-hover" onClick={irASuscripcion}>
              Ver qué incluye <ArrowRight size={13} strokeWidth={2.2} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </SectionCard>
  )
}
