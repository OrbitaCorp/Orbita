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
  const final = redondearCien(base * (1 + ajuste / 100))
  return { base, ajuste, final }
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
