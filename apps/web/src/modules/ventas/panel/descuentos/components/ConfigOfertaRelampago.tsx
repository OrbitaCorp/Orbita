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
//   - Ya hay OTRA oferta relámpago corriendo: solo puede haber una a la vez,
//     así que acá tampoco hay campos — dice cuál es y lleva a verla. (El
//     selector ya no deja elegir el tipo en este caso; esto cubre el
//     preseleccionado por URL y la edición de un descuento viejo.)
//   - Habilitada: los campos, más la nota de "solo una a la vez".

import { useRouter } from 'next/router'
import { ArrowRight, Ban, Lock, Timer } from 'lucide-react'
import { ConfigPorcentajeProducto } from './ConfigPorcentajeProducto'
import { useEstadoRelampago } from '../hooks/useEstadoRelampago'
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
  const { estado, vigente } = useEstadoRelampago(editandoId)

  const negocioId = currentSlug() ?? (router.query.negocioId as string) ?? 'rama-tienda'
  const moduloPadre = (router.query.moduloPadre as string) ?? 'ventas'
  const irASuscripcion = () => router.push({ pathname: adminPath(negocioId, moduloPadre, 'configuracion'), query: { vista: 'suscripcion' } })
  const irAAvanzado = () => router.push({ pathname: adminPath(negocioId, moduloPadre, 'avanzado') })
  const irAVigente = () => vigente && router.push({ pathname: adminPath(negocioId, moduloPadre, 'descuentos'), query: { vista: 'detalle', id: vigente.discountId, volver: 'crear' } })

  if (estado === null) return null

  if (estado !== 'disponible') {
    const titulo = estado === 'candado'
      ? 'La oferta relámpago es parte del paquete Avanzado'
      : estado === 'apagada'
        ? 'La oferta relámpago está apagada en Avanzado'
        : vigente?.programada ? 'Ya tenés una oferta relámpago programada' : 'Ya tenés una oferta relámpago activa'
    const texto = estado === 'candado'
      ? 'Un descuento que dura poco y se ve en tu tienda con un reloj que cuenta el tiempo que falta.'
      : estado === 'apagada'
        ? 'Entrá a Avanzado, prendé "Oferta relámpago" y volvé: todo lo demás se arma en este mismo formulario.'
        : `Es ${vigente?.name ?? 'otro descuento'}${vigente?.programada ? `, empieza el ${fmtFechaHora(vigente.startDate)}` : ''}${vigente?.endDate ? ` y termina el ${fmtFechaHora(vigente.endDate)}` : ''}. Solo puede haber una a la vez: cuando termine, o si la borrás, vas a poder crear otra.`
    const accion = estado === 'candado' ? 'Ver qué incluye' : estado === 'apagada' ? 'Ir a Avanzado' : vigente?.programada ? 'Ver mi oferta programada' : 'Ver mi oferta activa'
    const onClick = estado === 'candado' ? irASuscripcion : estado === 'apagada' ? irAAvanzado : irAVigente
    return (
      <div className="cor-aviso" data-tipo={estado}>
        <style>{ESTILOS}</style>
        <div className="cor-aviso-icono" aria-hidden="true">
          {estado === 'candado' ? <Lock size={16} strokeWidth={2} /> : estado === 'ocupada' ? <Ban size={16} strokeWidth={2} /> : <Timer size={16} strokeWidth={2} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cor-aviso-titulo">{titulo}</div>
          <p className="cor-aviso-texto">{texto}</p>
          <button type="button" className="cor-cta ds-hover" onClick={onClick}>
            {accion} <ArrowRight size={13} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{ESTILOS}</style>
      <ConfigPorcentajeProducto {...campos} />
      <p className="cor-nota">
        <Timer size={13} strokeWidth={2.2} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
        <span>Solo puede haber una oferta relámpago a la vez. Cuando llega la hora de fin, el reloj desaparece solo y el descuento deja de aplicarse.</span>
      </p>
    </div>
  )
}

const ESTILOS = `
.cor-aviso { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-surface-alt); }
.cor-aviso[data-tipo="apagada"] { border-color: var(--color-warning); background: var(--color-warning-bg); }
.cor-aviso[data-tipo="ocupada"] .cor-aviso-icono { color: var(--color-muted); }
.cor-aviso-icono { width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0; display: grid; place-items: center; background: var(--color-bg); color: var(--color-warning); border: 1px solid var(--color-border); }
.cor-aviso-titulo { font-size: 14px; font-weight: 600; color: var(--color-text); }
.cor-aviso-texto { margin: 4px 0 0; font-size: 13px; line-height: 1.55; color: var(--color-body); max-width: 64ch; }
.cor-cta { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; height: 36px; padding: 0 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; border: none; background: var(--color-primary); color: var(--color-on-primary); }
.cor-cta:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
.cor-nota { display: flex; gap: 8px; margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--color-muted); }
.cor-nota[data-tipo="aviso"] { color: var(--color-warning); }
`
