// Lo que el panel de Alquileres escribe, traducido a pedidos de la API de
// reservas. Puro: acá se decide QUÉ se le pide a la API; quién lo manda es
// api.ts. Es la vuelta de mapear.ts (la API → el panel).
//
// Por ahora, solo estadía por noche (etapa 1 del plan
// docs/superpowers/plans/2026-11-23-alquileres-en-produccion.md). El precio no
// viaja nunca: lo calcula el servidor (precio por noche × noches).
import type { CrearBloqueo, CrearDesdePanel, GuardarConfig, GuardarRecurso, Reserva as ReservaApi, Reservar } from '@/lib/reservasApi/tipos'
import type { Bloqueo, Cliente, NegocioAlquiler, Propiedad, Reserva } from '../index'

/** Una propiedad como recurso ALOJAMIENTO: lo que el servidor usa para reservar va en sus campos; lo descriptivo, en `datos`. */
export function recursoDePropiedad(p: Propiedad, orden: number): GuardarRecurso {
  return {
    modulo: 'ALQUILERES',
    tipo: 'ALOJAMIENTO',
    nombre: p.nombre.trim(),
    descripcion: p.descripcion,
    cupo: 1,
    precio: p.tarifa.precioNoche,
    orden,
    activo: true,
    datos: {
      checkIn: p.checkIn,
      checkOut: p.checkOut,
      nochesMinimas: p.tarifa.minNoches,
      tipo: p.tipo,
      huespedes: p.huespedes,
      ambientes: p.ambientes,
      camas: p.camas,
      banos: p.banos,
      comodidades: p.comodidades,
      fotos: p.fotos,
      direccion: p.direccion,
      ciudad: p.ciudad,
      latLng: p.latLng,
      modalidad: p.modalidad,
      // Temporadas, fin de semana y limpieza: se guardan para cuando el servidor las calcule (etapa 3).
      tarifa: { temporadas: p.tarifa.temporadas, finDeSemanaPct: p.tarifa.finDeSemanaPct, limpieza: p.tarifa.limpieza },
    },
  }
}

/** Qué hay que crear, editar y borrar para pasar de una lista de propiedades a otra. */
export function cambiosDePropiedades(antes: Propiedad[], despues: Propiedad[]): { crear: Propiedad[]; editar: Propiedad[]; borrar: string[] } {
  const previas = new Map(antes.map(p => [p.id, p]))
  const quedan = new Set(despues.map(p => p.id))
  return {
    crear: despues.filter(p => !previas.has(p.id)),
    editar: despues.filter(p => previas.has(p.id) && JSON.stringify(previas.get(p.id)) !== JSON.stringify(p)),
    borrar: antes.filter(p => !quedan.has(p.id)).map(p => p.id),
  }
}

/** Lo que un cambio del negocio le toca a la config de reservas, o null si no le toca nada. */
export function configDeCambio(cambio: Partial<NegocioAlquiler>): GuardarConfig | null {
  const c: GuardarConfig = { modulo: 'ALQUILERES' }
  if (cambio.cancelaHastaHoras !== undefined) { c.cancelacionHastaHoras = cambio.cancelaHastaHoras; c.reprogramacionHastaHoras = cambio.cancelaHastaHoras }
  if (cambio.senaPct !== undefined) c.senaPorcentaje = cambio.senaPct
  if (cambio.pagos) c.senaReembolsable = cambio.pagos.cancelaATiempo === 'devolver'
  return Object.keys(c).length > 1 ? c : null
}

/** Una reserva cargada a mano en el panel, como pedido a la API. */
export function pedidoDeReserva(r: Reserva, cliente: Cliente): CrearDesdePanel {
  if (!r.entrada || !r.salida) throw new Error('Por ahora el panel guarda solo estadías por noche.')
  const nota = [r.nota, r.huespedes ? `${r.huespedes} ${r.huespedes === 1 ? 'huésped' : 'huéspedes'}` : ''].filter(Boolean).join(' · ')
  return {
    modulo: 'ALQUILERES',
    recursoId: r.unidadId,
    fecha: r.entrada,
    fechaHasta: r.salida,
    cliente: { nombre: cliente.nombre, ...(cliente.telefono ? { telefono: cliente.telefono } : {}), ...(cliente.email ? { email: cliente.email } : {}) },
    ...(nota ? { notaInterna: nota } : {}),
    estado: r.estado === 'confirmada' ? 'CONFIRMADA' : 'PENDIENTE',
  }
}

export type Paso = { tipo: 'pago'; monto: number } | { tipo: 'confirmar' } | { tipo: 'completar' } | { tipo: 'cancelar' }

/**
 * Los pasos que pide un cambio hecho en la ficha de una reserva, en orden.
 * `actual` es la reserva como la tiene la API: de ahí sale cuánto falta pagar,
 * así nunca se anota dos veces lo mismo.
 */
export function pasosDeCambio(actual: Pick<ReservaApi, 'estado' | 'precio' | 'sena' | 'pagado'>, cambio: Partial<Reserva>): Paso[] {
  if (cambio.estado === 'cancelada') return [{ tipo: 'cancelar' }]
  const pasos: Paso[] = []
  let pagado = actual.pagado
  if (cambio.senaPagada && pagado < actual.sena) { pasos.push({ tipo: 'pago', monto: actual.sena - pagado }); pagado = actual.sena }
  if (cambio.saldoPagado && pagado < actual.precio) pasos.push({ tipo: 'pago', monto: actual.precio - pagado })
  if (cambio.estado === 'confirmada' && (actual.estado === 'PENDIENTE' || actual.estado === 'RETENIDA')) pasos.push({ tipo: 'confirmar' })
  if (cambio.estado === 'completada') pasos.push({ tipo: 'completar' })
  return pasos
}

/**
 * Un bloqueo de fechas de una propiedad. Ocupa lo mismo que una estadía: desde
 * la hora de entrada del primer día hasta la hora de salida del último. Así
 * quien sale ese primer día a la mañana no choca con el bloqueo, y el día
 * `hasta` queda libre para que entre otro.
 */
export function bloqueoParaApi(b: Bloqueo, propiedad: Pick<Propiedad, 'checkIn' | 'checkOut'> | undefined): CrearBloqueo {
  return {
    modulo: 'ALQUILERES',
    recursoId: b.unidadId,
    fechaDesde: b.desde,
    minutoDesde: propiedad?.checkIn ?? 14 * 60,
    fechaHasta: b.hasta,
    minutoHasta: propiedad?.checkOut ?? 10 * 60,
    motivo: b.motivo,
  }
}

/** El id de la API de un bloqueo del panel (uno de todo el negocio se muestra como "<id>:<unidad>", ver mapear.ts). */
export const idDeBloqueo = (id: string) => id.split(':')[0]

// ─── El sitio público ────────────────────────────────────────────────────────

/** Lo que un visitante completa para reservar una estadía. */
export interface PedidoSitio {
  propiedadId: string
  entrada: string
  salida: string
  nombre: string
  telefono: string
  email: string
  notas: string
  huespedes: number
  /** Un uuid por intento: si el pedido se repite (doble toque, reintento), el servidor devuelve la misma reserva. */
  clave: string
}

/**
 * El pedido de un visitante como lo recibe POST /storefront/:slug/reservas/reservar.
 * Sin precio: lo calcula el servidor. Cuántos vienen va en la nota, hasta que
 * la reserva tenga dónde guardarlo (etapa 3 del plan).
 */
export function pedidoDelSitio(p: PedidoSitio): Reservar {
  const notas = [`${p.huespedes} ${p.huespedes === 1 ? 'huésped' : 'huéspedes'}`, p.notas.trim()].filter(Boolean).join(' · ')
  const email = p.email.trim()
  return {
    modulo: 'ALQUILERES',
    recursoId: p.propiedadId,
    fecha: p.entrada,
    fechaHasta: p.salida,
    clave: p.clave,
    cliente: { nombre: p.nombre.trim(), telefono: p.telefono.trim(), ...(email ? { email } : {}) },
    notas,
  }
}
