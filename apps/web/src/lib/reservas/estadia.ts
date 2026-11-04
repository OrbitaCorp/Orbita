// Estadías: reservas por noches, con entrada y salida. La salida no se duerme:
// una reserva del 14 al 16 ocupa las noches del 14 y del 15, y otra puede
// entrar el 16. El precio por noche depende de la temporada y, si el dueño lo
// pide, del fin de semana. Hay una tarifa de limpieza fija por estadía.
import { diaSemana, diasEntre, esAntes, entre, rango, sumarDias, sumarMeses, type ISO } from './fechas'
import { conAjuste, redondearCien } from './precio'

export interface Temporada {
  id: string
  nombre: string
  desde: ISO
  hasta: ISO
  /** Precio por noche en esta temporada. */
  precioNoche: number
}

export interface RangoOcupado {
  entrada: ISO
  salida: ISO
  /** Para no compararse consigo misma al editar. */
  id?: string
  /** Una reserva o un bloqueo del dueño. */
  tipo?: 'reserva' | 'bloqueo'
}

export interface TarifaEstadia {
  /** Precio por noche fuera de temporada. */
  precioNoche: number
  temporadas: Temporada[]
  /** Recargo (%) sobre el precio de la noche los viernes y sábados. 0 = sin recargo. */
  finDeSemanaPct: number
  /** Tarifa fija de limpieza por estadía. */
  limpieza: number
  minNoches: number
}

export const nochesEntre = (entrada: ISO, salida: ISO) => Math.max(0, diasEntre(entrada, salida))

/** Las noches que se duermen: [entrada, salida). */
export const nochesDe = (entrada: ISO, salida: ISO): ISO[] => rango(entrada, salida)

export const rangoValido = (entrada: ISO, salida: ISO) => esAntes(entrada, salida)

export const cumpleMinimo = (entrada: ISO, salida: ISO, minNoches: number) => nochesEntre(entrada, salida) >= Math.max(1, minNoches)

/**
 * El rango pisa alguna ocupación. Dos estadías pueden tocarse: la salida de una
 * es la entrada de la otra. Devuelve la primera con la que choca, o null.
 */
export function chocaRango(entrada: ISO, salida: ISO, ocupadas: RangoOcupado[], id?: string): RangoOcupado | null {
  for (const o of ocupadas) {
    if (id && o.id === id) continue
    if (esAntes(entrada, o.salida) && esAntes(o.entrada, salida)) return o
  }
  return null
}

/** Las noches ocupadas (para pintar el calendario). */
export function nochesOcupadas(ocupadas: RangoOcupado[]): Set<ISO> {
  const out = new Set<ISO>()
  for (const o of ocupadas) for (const n of nochesDe(o.entrada, o.salida)) out.add(n)
  return out
}

/** Una noche se puede dormir si ninguna reserva ni bloqueo la toma. */
export const nocheLibre = (noche: ISO, ocupadas: RangoOcupado[]) => !nochesOcupadas(ocupadas).has(noche)

/**
 * Desde una entrada, hasta qué salida se puede llegar sin pisar nada: la
 * primera noche ocupada corta. Si la entrada misma está ocupada, null.
 */
export function salidaMaxima(entrada: ISO, ocupadas: RangoOcupado[], tope = 60): ISO | null {
  const tomadas = nochesOcupadas(ocupadas)
  if (tomadas.has(entrada)) return null
  let noches = 0
  while (noches < tope && !tomadas.has(sumarDias(entrada, noches))) noches++
  return sumarDias(entrada, noches)
}

/**
 * La temporada de una noche. Si se pisan dos (Carnaval adentro de la
 * temporada alta), manda la más corta: es la más específica.
 */
export function temporadaDe(noche: ISO, temporadas: Temporada[]): Temporada | null {
  let elegida: Temporada | null = null
  for (const t of temporadas) {
    if (!entre(noche, t.desde, t.hasta)) continue
    if (!elegida || diasEntre(t.desde, t.hasta) < diasEntre(elegida.desde, elegida.hasta)) elegida = t
  }
  return elegida
}

export interface NochePrecio { noche: ISO; precio: number; temporada: string | null; finDeSemana: boolean }

/**
 * Una noche lleva el nombre del día en que se duerme: la del viernes y la del
 * sábado son las de fin de semana. La del domingo ya es de semana (se sale el
 * lunes), por eso no sirve el `esFinDeSemana` de fechas, que mira días.
 */
export const nocheDeFinDeSemana = (noche: ISO) => { const d = diaSemana(noche); return d === 4 || d === 5 }

/** El precio de cada noche: temporada (o base) más el recargo de fin de semana. */
export function precioNoche(noche: ISO, t: TarifaEstadia): NochePrecio {
  const temp = temporadaDe(noche, t.temporadas)
  const base = temp?.precioNoche ?? t.precioNoche
  const fds = t.finDeSemanaPct > 0 && nocheDeFinDeSemana(noche)
  return { noche, precio: redondearCien(fds ? conAjuste(base, t.finDeSemanaPct) : base), temporada: temp?.nombre ?? null, finDeSemana: fds }
}

export interface PrecioEstadia {
  noches: NochePrecio[]
  subtotal: number
  limpieza: number
  total: number
  /** Promedio por noche, para mostrar "desde". */
  promedio: number
}

export function precioEstadia(entrada: ISO, salida: ISO, t: TarifaEstadia): PrecioEstadia {
  const noches = nochesDe(entrada, salida).map(n => precioNoche(n, t))
  const subtotal = noches.reduce((s, n) => s + n.precio, 0)
  const limpieza = noches.length ? t.limpieza : 0
  return { noches, subtotal, limpieza, total: subtotal + limpieza, promedio: noches.length ? Math.round(subtotal / noches.length) : 0 }
}

export interface GrupoNoches { noches: number; precio: number; temporada: string | null; finDeSemana: boolean }

/**
 * Las noches juntadas por lo que cuestan (y por qué: temporada, fin de
 * semana), en el orden en que aparecen. Es el detalle que explica el total:
 * "3 noches × $68.000" y "1 noche de temporada alta, fin de semana × $112.700",
 * en vez de un subtotal que no se sabe de dónde sale.
 */
export function agruparNoches(noches: NochePrecio[]): GrupoNoches[] {
  const out: GrupoNoches[] = []
  for (const n of noches) {
    const g = out.find(x => x.precio === n.precio && x.temporada === n.temporada && x.finDeSemana === n.finDeSemana)
    if (g) g.noches++
    else out.push({ noches: 1, precio: n.precio, temporada: n.temporada, finDeSemana: n.finDeSemana })
  }
  return out
}

/** Por qué no se puede reservar un rango, en palabras. null = se puede. */
export function motivoNoReservable(entrada: ISO, salida: ISO, t: TarifaEstadia, ocupadas: RangoOcupado[]): string | null {
  if (!rangoValido(entrada, salida)) return 'La salida tiene que ser después de la entrada.'
  if (!cumpleMinimo(entrada, salida, t.minNoches)) return `La estadía mínima es de ${t.minNoches} ${t.minNoches === 1 ? 'noche' : 'noches'}.`
  const choque = chocaRango(entrada, salida, ocupadas)
  if (choque) return choque.tipo === 'bloqueo' ? 'Esas fechas no están disponibles.' : 'Esas fechas ya están reservadas.'
  return null
}

// ─── Por mes ─────────────────────────────────────────────────────────────────
// Una propiedad que se alquila por mes (un depto temporario, una cochera, una
// oficina) ocupa su unidad igual que una estadía: desde la entrada hasta la
// salida, que es la misma fecha unos meses después. Lo que cambia es cómo se
// elige (una fecha y cuántos meses, no un rango de noches) y cómo se cobra (un
// precio por mes, sin limpieza ni temporadas, con un depósito que se registra
// y no se cobra desde Órbita).

export interface TarifaMensual {
  precioMes: number
  minMeses: number
  maxMeses: number
  /** Depósito de garantía, en pesos. 0 = no pide. */
  deposito: number
}

export interface PrecioMensual {
  meses: number
  precioMes: number
  /** meses × precioMes: lo que paga el inquilino por el alquiler. */
  total: number
  /** Aparte del total: se entrega al entrar y se devuelve al salir. */
  deposito: number
  entrada: ISO
  salida: ISO
}

/** La salida de un alquiler de `meses` meses: la misma fecha, esos meses después. */
export const salidaDeMeses = (entrada: ISO, meses: number): ISO => sumarMeses(entrada, Math.max(1, meses))

export function precioMensual(entrada: ISO, meses: number, t: TarifaMensual): PrecioMensual {
  const n = Math.max(1, Math.round(meses))
  return { meses: n, precioMes: t.precioMes, total: n * t.precioMes, deposito: t.deposito, entrada, salida: salidaDeMeses(entrada, n) }
}

/** Por qué no se puede alquilar desde esa fecha por esos meses, en palabras. null = se puede. */
export function motivoNoReservableMes(entrada: ISO, meses: number, t: TarifaMensual, ocupadas: RangoOcupado[]): string | null {
  if (meses < t.minMeses) return `El alquiler mínimo es de ${t.minMeses} ${t.minMeses === 1 ? 'mes' : 'meses'}.`
  if (meses > t.maxMeses) return `El alquiler máximo es de ${t.maxMeses} ${t.maxMeses === 1 ? 'mes' : 'meses'}.`
  const choque = chocaRango(entrada, salidaDeMeses(entrada, meses), ocupadas)
  if (choque) return choque.tipo === 'bloqueo' ? 'En esas fechas no está disponible.' : 'En esas fechas ya está alquilada.'
  return null
}

/**
 * Desde cuándo se puede entrar por `meses` meses a partir de `desde`: la primera
 * fecha (mirando día por día hasta `tope` días) desde la que el alquiler entero no
 * pisa nada. null si no hay ninguna en ese plazo.
 */
export function primeraEntradaLibre(desde: ISO, meses: number, ocupadas: RangoOcupado[], tope = 365): ISO | null {
  for (let i = 0; i <= tope; i++) {
    const f = sumarDias(desde, i)
    if (!chocaRango(f, salidaDeMeses(f, meses), ocupadas)) return f
  }
  return null
}
