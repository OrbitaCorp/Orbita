// Reglas de cómo se muestra el uso de Orbi en el panel (spec 2026-10-03 §6):
// siempre en porcentaje, nunca en créditos.
import type { AccionDeOrbi } from '../api/uso'

/** Clave de react-query del uso: la barra del chat y la vista del equipo cuelgan de acá. */
export const CLAVE_DE_USO = ['orbi', 'uso'] as const

type Uso = { negocio: { porcentaje: number }; propio: { porcentaje: number; topePorcentaje: number | null } }

/** Debajo de la mitad no hay nada que avisar: la barra no aparece. */
export function mostrarBarra(porcentaje: number): boolean {
  return porcentaje >= 50
}

export function tonoDeUso(porcentaje: number): 'normal' | 'alto' | 'agotado' {
  if (porcentaje >= 100) return 'agotado'
  if (porcentaje >= 80) return 'alto'
  return 'normal'
}

/**
 * El número que importa: el del cupo que se agota primero. Orbi frena con el
 * que llegue antes al 100%: el del negocio o, si la persona tiene tope, su
 * parte. Sin tope el propio se cuenta sobre todo el cupo y nunca supera al del
 * negocio. Es el mismo número que dice `textoDeUso`.
 */
export function porcentajeDeUso(u: Uso): number {
  return Math.max(u.propio.porcentaje, u.negocio.porcentaje)
}

/** Habla de la parte de la persona solo si tiene tope y es la que va adelante (o empatada). */
export function textoDeUso(u: Uso): string {
  return u.propio.topePorcentaje !== null && u.propio.porcentaje >= u.negocio.porcentaje
    ? `Usaste el ${u.propio.porcentaje}% de tu parte de Orbi este mes`
    : `El negocio usó el ${u.negocio.porcentaje}% de Orbi este mes`
}

/** "Uso del equipo": la API lo abre solo al dueño y a los administradores. */
export function puedeVerElEquipo(rol: string | undefined): boolean {
  return rol === 'owner' || rol === 'admin'
}

/** Repartir el cupo (los topes) es solo del dueño; el administrador lo ve. */
export function puedeFijarTopes(rol: string | undefined): boolean {
  return rol === 'owner'
}

/** Los topes que se eligen de una; cualquier otro entero de 10 a 100 va por "Otro". */
export const TOPES_FIJOS = [25, 50, 75] as const
export const TOPE_MINIMO = 10
export const TOPE_MAXIMO = 100

export type ValorDelSelector = 'sin' | '25' | '50' | '75' | 'otro'

export function valorDelSelector(tope: number | null): ValorDelSelector {
  if (tope === null) return 'sin'
  return (TOPES_FIJOS as readonly number[]).includes(tope) ? (String(tope) as ValorDelSelector) : 'otro'
}

/** Lo que escribió el dueño en "Otro": un entero de 10 a 100, o null si no sirve (como valida la API). */
export function leerTope(texto: string): number | null {
  const limpio = texto.trim()
  if (!/^\d+$/.test(limpio)) return null
  const n = Number(limpio)
  return n >= TOPE_MINIMO && n <= TOPE_MAXIMO ? n : null
}

export function etiquetaDeTope(tope: number | null): string {
  return tope === null ? 'Sin tope' : `${tope}%`
}

/** La API guarda 30 días de acciones; acá se recorta igual por si la retención cambia. */
export const DIAS_DE_ACCIONES = 30
const DIA_MS = 24 * 60 * 60 * 1000

export function accionesRecientes(acciones: AccionDeOrbi[], ahora: Date): AccionDeOrbi[] {
  const corte = ahora.getTime() - DIAS_DE_ACCIONES * DIA_MS
  return acciones.filter(a => a.fecha === null || new Date(a.fecha).getTime() >= corte)
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** 'YYYY-MM' (el mes argentino que manda la API) → "octubre de 2026". */
export function etiquetaDeMes(mes: string): string {
  const [anio, m] = mes.split('-')
  const nombre = MESES[Number(m) - 1]
  return nombre ? `${nombre} de ${anio}` : mes
}

/** Argentina es UTC-3 todo el año (sin horario de verano desde 2009). */
const DESFASE_ARGENTINA_MS = 3 * 60 * 60 * 1000
const dos = (n: number) => String(n).padStart(2, '0')

/** "dd/mm hh:mm" en hora argentina, igual en el server y en el navegador. */
export function fechaDeAccion(fecha: string | null): string {
  if (!fecha) return '—'
  const d = new Date(new Date(fecha).getTime() - DESFASE_ARGENTINA_MS)
  if (Number.isNaN(d.getTime())) return '—'
  return `${dos(d.getUTCDate())}/${dos(d.getUTCMonth() + 1)} ${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`
}

export function textoDeEstado(estado: AccionDeOrbi['estado']): string {
  return estado === 'executed' ? 'Hecho' : 'Falló'
}
