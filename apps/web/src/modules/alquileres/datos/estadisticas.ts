// Las cuentas de las Estadísticas de la estadía: ocupación, ingresos por canal,
// precio por noche e ingreso por noche disponible, con lo que se reservó en
// Órbita más lo que el dueño cobró por Airbnb (las ganancias importadas).
// Función pura, sin pantalla: la usan la demo y el panel real.
//
// Reglas (diseño: docs/superpowers/specs/2026-11-26-alquileres-estadisticas-y-csv-airbnb-design.md):
//
// - Todo se mide POR NOCHES, sobre el mismo tramo: del inicio del período
//   hasta hoy. La plata de una estadía se reparte entre sus noches, así una que
//   cruza el borde del período aporta solo la parte que le toca. Si la plata
//   contara entera por la fecha de entrada y las noches hasta hoy, el tercer
//   día del mes el ingreso por noche disponible saldría inflado.
// - Las noches ocupadas de una propiedad son un CONJUNTO: una noche que está
//   por dos lados (el bloqueo de Airbnb y su estadía importada) cuenta una vez.
// - Cuentan las reservas confirmadas y realizadas, y las estadías importadas
//   con neto mayor que cero (cero o menos es una devolución).
// - Nunca se suman monedas distintas: los pesos suman solo ARS; lo demás va
//   aparte, con su moneda, y no entra en los promedios.
// - Sin redondear acá: la pantalla redondea al mostrar.
import { diasEntre, sumarDias, type ISO } from '@/lib/reservas/fechas'
import type { Bloqueo, IngresoExterno, NegocioAlquiler, Reserva } from './index'

export type Canal = 'directo' | 'sitio' | 'airbnb'

export interface NumerosDePropiedad {
  unidadId: string
  nombre: string
  nochesDisponibles: number
  nochesOcupadas: number
  /** 0 a 1. */
  ocupacion: number
  /** En pesos. */
  ingresos: number
  precioPorNoche: number | null
}

export interface EstadisticasEstadia {
  nochesDisponibles: number
  nochesOcupadas: number
  /** 0 a 1. */
  ocupacion: number
  /** En pesos: reservas propias más Airbnb en ARS (neto de comisión), de las noches del tramo. */
  ingresos: number
  porCanal: Record<Canal, { estadias: number; ingresos: number }>
  /** Lo cobrado en otra moneda, por moneda: no se suma a los pesos. */
  otrasMonedas: { moneda: string; neto: number; estadias: number }[]
  /** Las noches del tramo de las estadías que suman a `ingresos`. */
  nochesVendidas: number
  precioPorNoche: number | null
  ingresoPorNocheDisponible: number | null
  /** Noches, de las estadías con alguna noche en el tramo. */
  estadiaPromedio: number | null
  /** Días entre que se reservó y la entrada; solo reservas propias. */
  anticipacionPromedio: number | null
  /** Lo ya reservado de mañana al fin del período (pesos y noches); ceros si el período ya terminó. */
  porVenir: { ingresos: number; noches: number }
  porPropiedad: NumerosDePropiedad[]
  /** Estadías importadas que pisan noches de una reserva propia de la misma propiedad. */
  cruces: { codigo: string; unidadId: string; entrada: ISO; salida: ISO; reservaId: string }[]
}

/** Una estadía, propia o de Airbnb, con lo que hace falta para contarla. */
interface Estadia { unidadId: string; entrada: ISO; salida: ISO; monto: number; moneda: string; canal: Canal; creada?: ISO; reservaId?: string; codigo?: string }

const mayor = (a: ISO, b: ISO) => (a > b ? a : b)
const menor = (a: ISO, b: ISO) => (a < b ? a : b)
/** Cuántas noches de [entrada, salida) caen en [desde, tope). */
const nochesEn = (entrada: ISO, salida: ISO, desde: ISO, tope: ISO) => Math.max(0, diasEntre(mayor(entrada, desde), menor(salida, tope)))
/** Esas noches, una por una. */
function cadaNoche(entrada: ISO, salida: ISO, desde: ISO, tope: ISO, hacer: (noche: ISO) => void) {
  for (let n = mayor(entrada, desde); n < menor(salida, tope); n = sumarDias(n, 1)) hacer(n)
}

const cuenta = (r: Reserva) => (r.estado === 'confirmada' || r.estado === 'completada') && !!r.entrada && !!r.salida && r.salida > r.entrada
/** Un bloqueo de Airbnb que allá es una reserva. Sin el dato (un bloqueo de antes de que el panel lo supiera), se toma como reserva. */
const esEstadiaDeAirbnb = (b: Bloqueo) => b.origen === 'ical' && b.externoTipo !== 'CERRADO'

export function estadisticasDeEstadia(
  n: Pick<NegocioAlquiler, 'propiedades' | 'bloqueos' | 'ingresosExternos'>,
  reservas: Reserva[],
  desde: ISO,
  hasta: ISO,
  hoy: ISO,
): EstadisticasEstadia {
  // El tramo: las noches de `desde` a min(hasta, hoy), las dos incluidas. Lo que viene: de ahí al fin del período.
  const finDelPeriodo = sumarDias(hasta, 1)
  const tope = mayor(desde, menor(finDelPeriodo, sumarDias(hoy, 1)))
  const nochesDelTramo = diasEntre(desde, tope)

  const propias: Estadia[] = reservas.filter(cuenta).map(r => ({ unidadId: r.unidadId, entrada: r.entrada!, salida: r.salida!, monto: r.total, moneda: 'ARS', canal: r.canal === 'sitio' ? 'sitio' : 'directo', creada: r.creada, reservaId: r.id }))
  const importadas: Estadia[] = (n.ingresosExternos ?? []).filter(e => e.neto > 0 && e.salida > e.entrada).map(e => ({ unidadId: e.unidadId, entrada: e.entrada, salida: e.salida, monto: e.neto, moneda: e.moneda, canal: 'airbnb', codigo: e.codigo }))
  const estadias = [...propias, ...importadas]

  const porCanal: EstadisticasEstadia['porCanal'] = { directo: { estadias: 0, ingresos: 0 }, sitio: { estadias: 0, ingresos: 0 }, airbnb: { estadias: 0, ingresos: 0 } }
  const otras = new Map<string, { neto: number; estadias: number }>()
  const porVenir = { ingresos: 0, noches: 0 }
  let ingresos = 0
  let nochesVendidas = 0
  const largos: number[] = []
  const anticipaciones: number[] = []
  const pesosDe = new Map<string, { ingresos: number; noches: number }>()

  for (const e of estadias) {
    const total = diasEntre(e.entrada, e.salida)
    const enTramo = nochesEn(e.entrada, e.salida, desde, tope)
    const despues = nochesEn(e.entrada, e.salida, tope, finDelPeriodo)
    const enPesos = e.moneda === 'ARS'
    if (enPesos && despues > 0) {
      porVenir.ingresos += (e.monto * despues) / total
      porVenir.noches += despues
    }
    if (enTramo === 0) continue
    const parte = (e.monto * enTramo) / total
    porCanal[e.canal].estadias++
    largos.push(total)
    if (e.creada) anticipaciones.push(Math.max(0, diasEntre(e.creada, e.entrada)))
    if (!enPesos) {
      const o = otras.get(e.moneda) ?? { neto: 0, estadias: 0 }
      otras.set(e.moneda, { neto: o.neto + parte, estadias: o.estadias + 1 })
      continue
    }
    ingresos += parte
    nochesVendidas += enTramo
    porCanal[e.canal].ingresos += parte
    const p = pesosDe.get(e.unidadId) ?? { ingresos: 0, noches: 0 }
    pesosDe.set(e.unidadId, { ingresos: p.ingresos + parte, noches: p.noches + enTramo })
  }

  const porPropiedad: NumerosDePropiedad[] = n.propiedades.map(p => {
    const ocupadas = new Set<ISO>()
    const anotar = (entrada: ISO, salida: ISO) => cadaNoche(entrada, salida, desde, tope, noche => ocupadas.add(noche))
    for (const e of estadias) if (e.unidadId === p.id) anotar(e.entrada, e.salida)
    const bloqueos = n.bloqueos.filter(b => b.unidadId === p.id)
    for (const b of bloqueos) if (esEstadiaDeAirbnb(b)) anotar(b.desde, b.hasta)
    // No disponibles: lo que bloqueó el dueño o cerró a mano en Airbnb, salvo que igual esté ocupado.
    const cerradas = new Set<ISO>()
    for (const b of bloqueos) if (!esEstadiaDeAirbnb(b)) cadaNoche(b.desde, b.hasta, desde, tope, noche => { if (!ocupadas.has(noche)) cerradas.add(noche) })
    const disponibles = nochesDelTramo - cerradas.size
    const plata = pesosDe.get(p.id) ?? { ingresos: 0, noches: 0 }
    return {
      unidadId: p.id, nombre: p.nombre, nochesDisponibles: disponibles, nochesOcupadas: ocupadas.size,
      ocupacion: disponibles > 0 ? ocupadas.size / disponibles : 0,
      ingresos: plata.ingresos, precioPorNoche: plata.noches > 0 ? plata.ingresos / plata.noches : null,
    }
  })
  const nochesDisponibles = porPropiedad.reduce((s, p) => s + p.nochesDisponibles, 0)
  const nochesOcupadas = porPropiedad.reduce((s, p) => s + p.nochesOcupadas, 0)

  // Cruces: una estadía importada sobre noches de una reserva propia de la misma propiedad, si alguna toca el período.
  const tocaElPeriodo = (e: Estadia) => e.entrada < finDelPeriodo && e.salida > desde
  const cruces = importadas.flatMap(i => propias
    .filter(r => r.unidadId === i.unidadId && i.entrada < r.salida && r.entrada < i.salida && (tocaElPeriodo(i) || tocaElPeriodo(r)))
    .map(r => ({ codigo: i.codigo!, unidadId: i.unidadId, entrada: i.entrada, salida: i.salida, reservaId: r.reservaId! })))

  const promedio = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)
  return {
    nochesDisponibles, nochesOcupadas, ocupacion: nochesDisponibles > 0 ? nochesOcupadas / nochesDisponibles : 0,
    ingresos, porCanal,
    otrasMonedas: [...otras].sort(([a], [b]) => a.localeCompare(b)).map(([moneda, o]) => ({ moneda, ...o })),
    nochesVendidas,
    precioPorNoche: nochesVendidas > 0 ? ingresos / nochesVendidas : null,
    ingresoPorNocheDisponible: nochesDisponibles > 0 ? ingresos / nochesDisponibles : null,
    estadiaPromedio: promedio(largos), anticipacionPromedio: promedio(anticipaciones),
    porVenir, porPropiedad, cruces,
  }
}

/** La estadía importada que corresponde a un bloqueo de Airbnb: misma propiedad y mismas fechas. */
export function estadiaDelBloqueo(b: Bloqueo, externos: IngresoExterno[] | undefined): IngresoExterno | undefined {
  if (b.origen !== 'ical') return undefined
  return externos?.find(e => e.unidadId === b.unidadId && e.entrada === b.desde && e.salida === b.hasta)
}
