// Lo que la sección "Ganancias de Airbnb" decide sin pantalla: a qué propiedad
// va cada aviso del archivo y cómo se dice el total. Aparte de
// GananciasAirbnb.tsx para poder probarlo.
import { pesos } from '@/lib/reservas/precio'

/** El tope del archivo, el mismo que aplica el servidor: uno más grande ni se manda. */
export const MAXIMO_BYTES_CSV = 2_000_000
export const DEMASIADO_GRANDE = 'El archivo es demasiado grande. Descargalo por año.'

/** Lo elegido para cada aviso: el id de una propiedad, null si no se importa, undefined si falta decidir. */
export type Elegidas = Record<string, string | null | undefined>

/** Las uniones que se mandan: la elegida para cada aviso; undefined si falta decidir alguno. */
export function unionesListas(avisos: { nombre: string }[], elegidas: Elegidas): { nombre: string; recursoId: string | null }[] | undefined {
  if (avisos.some(a => elegidas[a.nombre] === undefined)) return undefined
  return avisos.map(a => ({ nombre: a.nombre, recursoId: elegidas[a.nombre] ?? null }))
}

/**
 * Lo que se propone al abrir la vista previa: la unión que ya estaba guardada
 * (si esa propiedad sigue en la lista) y, con un solo aviso y una sola
 * propiedad, esa. En cualquier otro caso no se adivina: lo decide el dueño.
 * (Con dos avisos y una propiedad cargada, uno puede no ser de este negocio.)
 */
export function unionesPropuestas(avisos: { nombre: string; recursoId: string | null }[], propiedades: { id: string }[]): Elegidas {
  const elegidas: Elegidas = {}
  for (const a of avisos) {
    if (a.recursoId && propiedades.some(p => p.id === a.recursoId)) elegidas[a.nombre] = a.recursoId
    else if (avisos.length === 1 && propiedades.length === 1) elegidas[a.nombre] = propiedades[0].id
  }
  return elegidas
}

/**
 * El texto del archivo. Airbnb lo da en UTF-8; si alguien lo abrió y lo guardó
 * con Excel puede venir en ANSI (Windows-1252), y leído como UTF-8 los
 * encabezados con acento ("Código de confirmación") no se reconocerían.
 */
export function decodificar(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/** Un monto con su moneda: los pesos con su signo, lo demás con su código ("USD 300,5"). */
export const enMoneda = (moneda: string, monto: number) => (moneda === 'ARS' ? pesos(monto) : `${moneda} ${monto.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`)

/** El total de la vista previa, cada moneda por separado: nunca se suman. */
export const totalesTxt = (totales: { moneda: string; neto: number; estadias?: number }[]) => totales.map(t => enMoneda(t.moneda, t.neto)).join(' · ')
