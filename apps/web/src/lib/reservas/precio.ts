// Cuánto sale una reserva: precio por hora con franjas (descuento en horarios
// flojos, recargo en los picos), paquete más extras, seña y redondeo. Todo en
// pesos enteros. Sin fechas relativas: el día de la semana entra como número.

export interface ReglaFranja {
  /** Días de la semana a los que aplica (0 = lunes). Vacío = todos. */
  dias: number[]
  /** Minutos desde las 00:00. La franja es [desde, hasta). */
  desde: number
  hasta: number
  /** Porcentaje sobre el precio base: -15 es un descuento, 20 un recargo. */
  ajuste: number
}

export interface Extra {
  id: string
  nombre: string
  precio: number
}

/** Redondea a los cien pesos más cercanos: los precios de vidriera no llevan monedas. */
export const redondearCien = (n: number) => Math.round(n / 100) * 100

/** El ajuste (en %) que aplica a un horario, o 0. Si varias franjas aplican, manda la primera. */
export function ajusteDe(dia: number, inicio: number, reglas: ReglaFranja[]): number {
  const r = reglas.find(x => (x.dias.length === 0 || x.dias.includes(dia)) && inicio >= x.desde && inicio < x.hasta)
  return r?.ajuste ?? 0
}

/**
 * Precio de una reserva por hora: la tarifa por hora, por la duración, con el
 * ajuste de la franja en que arranca. Devuelve el precio base y el final.
 */
export function precioPorHora(tarifaHora: number, duracionMin: number, dia: number, inicio: number, reglas: ReglaFranja[] = []) {
  const base = redondearCien((tarifaHora * duracionMin) / 60)
  const ajuste = ajusteDe(dia, inicio, reglas)
  const final = redondearCien(conAjuste(base, ajuste))
  return { base, ajuste, final }
}

/**
 * Un monto con un porcentaje encima (o de descuento), sin perder centavos en
 * el camino: 45.000 × 1,15 da 51.749,999… en coma flotante y redondeaba a
 * 51.700; multiplicando por 115 y dividiendo por 100 da 51.750 justo, que
 * redondea a 51.800.
 */
export const conAjuste = (monto: number, pct: number) => (monto * (100 + pct)) / 100

/** Un tramo de turnos seguidos con el mismo ajuste: [inicio, fin) en minutos. */
export interface TramoPrecio { inicio: number; fin: number; ajuste: number; base: number; final: number }

/**
 * Varios turnos seguidos de una cancha: cada turno se cobra con el ajuste de
 * SU franja, no con el del primero. Con `precioPorHora` sobre la duración
 * total, de 15 a 17 un día de semana cobraba las dos horas con el -15 % de la
 * primera, y de 21 a 24 el recargo del pico de 19 a 22 caía también en las dos
 * horas que ya no son pico. Los turnos seguidos con el mismo ajuste se juntan
 * en un tramo (y se redondea una vez por tramo): así dos horas con el mismo
 * ajuste cuestan lo mismo que con `precioPorHora` y se muestran en una línea.
 */
export function precioTurnosSeguidos(tarifaHora: number, duracionTurno: number, turnos: number, dia: number, inicio: number, reglas: ReglaFranja[] = []) {
  const tramos: TramoPrecio[] = []
  for (let i = 0; i < Math.max(0, turnos); i++) {
    const desde = inicio + i * duracionTurno
    const ajuste = ajusteDe(dia, desde, reglas)
    const ultimo = tramos[tramos.length - 1]
    if (ultimo && ultimo.ajuste === ajuste) ultimo.fin = desde + duracionTurno
    else tramos.push({ inicio: desde, fin: desde + duracionTurno, ajuste, base: 0, final: 0 })
  }
  for (const t of tramos) {
    const p = precioPorHora(tarifaHora, t.fin - t.inicio, dia, t.inicio, reglas)
    t.base = p.base
    t.final = p.final
  }
  return { base: tramos.reduce((s, t) => s + t.base, 0), final: tramos.reduce((s, t) => s + t.final, 0), tramos }
}

/** Precio de un salón: el paquete elegido más los extras marcados. */
export function precioBloque(paquete: number, extras: Extra[], elegidos: string[]) {
  const sumaExtras = extras.filter(e => elegidos.includes(e.id)).reduce((s, e) => s + e.precio, 0)
  return { paquete, extras: sumaExtras, total: paquete + sumaExtras }
}

/** La seña: un porcentaje del total, redondeado a cien. 0 % = sin seña. */
export const senaDe = (total: number, pct: number) => (pct <= 0 || total <= 0 ? 0 : redondearCien((total * pct) / 100))

/** Lo que queda por pagar después de la seña. */
export const saldoDe = (total: number, sena: number) => Math.max(0, total - sena)

/** "$45.000" con separador de miles argentino. */
export const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`
