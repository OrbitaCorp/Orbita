// Sección "Configuración del descuento" para el tipo "Oferta relámpago"
// (paquete Avanzado, RBT-675).
//
// La oferta en sí es un % en productos o categorías, exactamente igual que
// "% Producto" — por eso reusa ConfigPorcentajeProducto tal cual. Lo que suma
// esta sección es el contexto que ese tipo necesita:
//
//   - SIN el paquete Avanzado: la tarjeta se ve entera y legible, con el
//     candado y "Ver qué incluye" — a propósito no gris ni borrosa (si no se
//     entiende qué hace, nadie la compra). El gate real vive en el backend.
//   - CON el paquete pero con el interruptor de Avanzado apagado: dice dónde
//     prenderlo. El formulario no deja guardar mientras tanto.
//   - Habilitada: los campos, más el aviso de "solo una a la vez" con quién la
//     tiene hoy (si es otro descuento): al guardar, pasa a este.

import { useRouter } from 'next/router'
import { ArrowRight, Lock, Timer } from 'lucide-react'
import { ConfigPorcentajeProducto } from './ConfigPorcentajeProducto'
import { useAddons } from '../hooks/useAddons'
import { useCountdownSettings } from '../hooks/useCountdownSettings'
import { adminPath, currentSlug } from '@/lib/tenant'
import { fmtFechaHora } from '../utils'
import type { AlcanceDescuento } from '../types'

interface Props {
  // Id del descuento en edición: si es el que ya tiene la oferta, no hay
  // nada que avisar.
  editandoId?: string
  valor: string
  alcance: AlcanceDescuento
  productosIds: string[]
  categoriasIds: string[]
  onChangeValor: (v: string) => void
  onChangeAlcance: (a: AlcanceDescuento) => void
  onChangeProductos: (ids: string[]) => void
  onChangeCategorias: (ids: string[]) => void
  errores?: Record<string, string>
}

export function ConfigOfertaRelampago({ editandoId, ...campos }: Props) {
  const router = useRouter()
  const { data: addons, isLoading } = useAddons()
  const { data: settings } = useCountdownSettings()

  const negocioId = currentSlug() ?? (router.query.negocioId as string) ?? 'rama-tienda'
  const moduloPadre = (router.query.moduloPadre as string) ?? 'ventas'
  const irASuscripcion = () => router.push({ pathname: adminPath(negocioId, moduloPadre, 'configuracion'), query: { vista: 'suscripcion' } })
  const irAAvanzado = () => router.push({ pathname: adminPath(negocioId, moduloPadre, 'avanzado') })

  if (isLoading) return null

  const sinPaquete = !(addons?.advanced ?? false)
  const deshabilitada = !sinPaquete && !(addons?.flashSaleEnabled ?? false)

  if (sinPaquete || deshabilitada) {
    return (
      <div className="cor-aviso" data-tipo={sinPaquete ? 'paquete' : 'interruptor'}>
        <style>{ESTILOS}</style>
        <div className="cor-aviso-icono" aria-hidden="true">
          {sinPaquete ? <Lock size={16} strokeWidth={2} /> : <Timer size={16} strokeWidth={2} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cor-aviso-titulo">
            {sinPaquete ? 'La oferta relámpago es parte del paquete Avanzado' : 'La oferta relámpago está apagada en Avanzado'}
          </div>
          <p className="cor-aviso-texto">
            {sinPaquete
              ? 'Un porcentaje en los productos que elijas, que termina a una hora exacta y se muestra en la portada de tu tienda con un reloj corriendo y esos productos ya rebajados.'
              : 'Prendé el interruptor de la tarjeta "Oferta relámpago" en Avanzado y volvé acá: el resto se configura en este mismo formulario.'}
          </p>
          <button type="button" className="cor-cta ds-hover" onClick={sinPaquete ? irASuscripcion : irAAvanzado}>
            {sinPaquete ? 'Ver qué incluye' : 'Ir a Avanzado'} <ArrowRight size={13} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
      </div>
    )
  }

  const otra = settings?.actual && settings.actual.discountId !== editandoId ? settings.actual : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{ESTILOS}</style>
      <ConfigPorcentajeProducto {...campos} />
      <p className="cor-nota" data-tipo={otra ? 'aviso' : undefined}>
        <Timer size={13} strokeWidth={2.2} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
        {otra ? (
          <span>
            Solo puede haber una oferta relámpago a la vez. Hoy la tiene <strong>{otra.name}</strong>
            {otra.endDate ? ` (termina el ${fmtFechaHora(otra.endDate)})` : ''}: al guardar, pasa a esta.
          </span>
        ) : (
          <span>Solo puede haber una oferta relámpago a la vez. Se muestra en la portada con un reloj hasta la hora de fin y se apaga sola cuando vence.</span>
        )}
      </p>
    </div>
  )
}

const ESTILOS = `
.cor-aviso { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-surface-alt); }
.cor-aviso[data-tipo="interruptor"] { border-color: var(--color-warning); background: var(--color-warning-bg); }
.cor-aviso-icono { width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; display: grid; place-items: center; background: var(--color-bg); color: var(--color-warning); border: 1px solid var(--color-border); }
.cor-aviso-titulo { font-size: 14px; font-weight: 600; color: var(--color-text); }
.cor-aviso-texto { margin: 4px 0 0; font-size: 13px; line-height: 1.55; color: var(--color-body); max-width: 64ch; }
.cor-cta { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; height: 36px; padding: 0 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; border: none; background: var(--color-primary); color: var(--color-on-primary); }
.cor-cta:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.cor-nota { display: flex; gap: 8px; margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--color-muted); }
.cor-nota[data-tipo="aviso"] { color: var(--color-warning); }
`
