// Lo que el sitio público de un negocio real le pide a la API, sin sesión:
// la config de la tienda (nombre, contacto, alias), la de reservas, lo que se
// alquila y las noches ocupadas de cada propiedad. Las traducciones a los
// tipos de las pantallas están en mapear.ts (negocioDelSitio) y el pedido de
// reserva, en escribir.ts (pedidoDelSitio).
//
// Por ahora, solo estadía por noche (etapa 2 del plan
// docs/superpowers/plans/2026-11-23-alquileres-en-produccion.md).
import { getStorefrontConfig } from '@/lib/storefront/api'
import { ReservasApiError, sitio } from '@/lib/reservasApi/cliente'
import type { Noches, ReservaConToken } from '@/lib/reservasApi/tipos'
import { sumarDias, type ISO } from '@/lib/reservas/fechas'
import type { NegocioAlquiler, Reserva, TipoAlquiler } from '../index'
import { negocioDelSitio, reservaDeApi } from './mapear'
import { pedidoDelSitio, type PedidoSitio } from './escribir'

/** Hasta cuántos días adelante se piden las noches ocupadas, aunque el negocio deje reservar más lejos. */
export const DIAS_DE_CALENDARIO = 365
/** La API acepta rangos de menos de 186 días por pedido (disponibilidad.service.ts, MAX_DIAS_RANGO × 2). */
const DIAS_POR_PEDIDO = 180

export interface CargaSitio {
  tipo: TipoAlquiler
  negocio: NegocioAlquiler
  /** El último día que se puede reservar: hoy más la anticipación máxima del negocio. */
  ultimoDia: ISO
  /** El negocio confirma a mano: la reserva nace pendiente. */
  confirmaElNegocio: boolean
}

/** Las noches ocupadas de una propiedad entre dos días, en los pedidos que haga falta (de a uno: la API limita por IP). */
async function nochesEntre(slug: string, recursoId: string, desde: ISO, hasta: ISO): Promise<Pick<Noches, 'recursoId' | 'ocupadas'>> {
  const ocupadas: string[] = []
  for (let d = desde; d <= hasta; d = sumarDias(d, DIAS_POR_PEDIDO)) {
    const fin = sumarDias(d, DIAS_POR_PEDIDO - 1)
    const n = await sitio(slug).noches({ modulo: 'ALQUILERES', recursoId, desde: d, hasta: fin < hasta ? fin : hasta })
    ocupadas.push(...n.ocupadas)
  }
  return { recursoId, ocupadas }
}

/** Todo lo que el sitio necesita para dibujarse y dejar reservar. Falla con el mensaje de la API (negocio pausado, reservas pausadas). */
export async function cargarSitio(slug: string, hoy: ISO): Promise<CargaSitio> {
  const api = sitio(slug)
  const [tienda, config, recursos] = await Promise.all([getStorefrontConfig(slug), api.config('ALQUILERES'), api.recursos('ALQUILERES')])
  const dias = Math.max(1, Math.min(config.anticipacionMaximaDias, DIAS_DE_CALENDARIO))
  const ultimoDia = sumarDias(hoy, dias)
  const noches: Pick<Noches, 'recursoId' | 'ocupadas'>[] = []
  for (const r of recursos.filter(x => x.activo && x.tipo === 'ALOJAMIENTO')) noches.push(await nochesEntre(slug, r.id, hoy, ultimoDia))
  return { ...negocioDelSitio({ tienda, config, recursos, noches }), ultimoDia, confirmaElNegocio: config.confirmacion === 'MANUAL' }
}

/** Lo que el sitio usa de una reserva recién hecha: la reserva con la forma de las pantallas, su código y su token. */
export interface HechaEnSitio { reserva: Reserva; codigo: string; token: string; pendiente: boolean }

export type ResultadoDelPedido = { ok: true; hecha: HechaEnSitio } | { ok: false; mensaje: string; ocupado: boolean }

export function hechaDeApi(r: ReservaConToken, huespedes: number): HechaEnSitio | null {
  const reserva = reservaDeApi(r, 'estadia')
  return reserva ? { reserva: { ...reserva, huespedes }, codigo: r.codigo, token: r.token, pendiente: r.estado !== 'CONFIRMADA' } : null
}

/**
 * Reserva en un paso. No tira: devuelve qué pasó, con el mensaje de la API
 * (ya en castellano). `ocupado` es el 409: esas noches se tomaron mientras
 * tanto y hay que elegir otras.
 */
export async function reservarEnSitio(slug: string, p: PedidoSitio): Promise<ResultadoDelPedido> {
  try {
    const hecha = hechaDeApi(await sitio(slug).reservar(pedidoDelSitio(p)), p.huespedes)
    return hecha ? { ok: true, hecha } : { ok: false, mensaje: 'La reserva no quedó tomada. Probá de nuevo.', ocupado: false }
  } catch (e) {
    if (e instanceof ReservasApiError) return { ok: false, mensaje: e.message, ocupado: e.esConflicto }
    return { ok: false, mensaje: 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo: no se duplica la reserva.', ocupado: false }
  }
}
