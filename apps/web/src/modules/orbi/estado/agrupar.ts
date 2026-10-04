// La lista de sesiones agrupada por cuándo se usó cada una (spec fase 3, §6.4),
// en días de Argentina: una sesión de las 22 h de ayer en Buenos Aires es de
// "Ayer" aunque en UTC ya sea hoy.
import type { ResumenDeSesion } from '../api/sesiones'

export type Grupo = 'Fijadas' | 'Hoy' | 'Ayer' | 'Esta semana' | 'Antes'

const ZONA = 'America/Argentina/Buenos_Aires'
const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' })

/** Días de Argentina entre dos instantes (0 = mismo día). */
export function diasArgentinos(desde: Date, hasta: Date): number {
  const dia = (d: Date) => Date.parse(`${formatoDia.format(d)}T00:00:00Z`)
  return Math.round((dia(hasta) - dia(desde)) / 86_400_000)
}

export function grupoDe(ultimaActividad: string, ahora: Date): Exclude<Grupo, 'Fijadas'> {
  const dias = diasArgentinos(new Date(ultimaActividad), ahora)
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  if (dias < 7) return 'Esta semana'
  return 'Antes'
}

/** Fijadas arriba; después los grupos por fecha, en orden y sin grupos vacíos. */
export function agruparSesiones(
  fijadas: ResumenDeSesion[],
  sesiones: ResumenDeSesion[],
  ahora: Date,
): { grupo: Grupo; sesiones: ResumenDeSesion[] }[] {
  const orden: Grupo[] = ['Fijadas', 'Hoy', 'Ayer', 'Esta semana', 'Antes']
  const porGrupo = new Map<Grupo, ResumenDeSesion[]>(orden.map(g => [g, []]))
  porGrupo.get('Fijadas')!.push(...fijadas)
  const yaFijadas = new Set(fijadas.map(s => s.id))
  for (const s of sesiones) {
    if (yaFijadas.has(s.id)) continue
    porGrupo.get(grupoDe(s.ultimaActividad, ahora))!.push(s)
  }
  return orden.flatMap(grupo => {
    const lista = porGrupo.get(grupo)!
    return lista.length ? [{ grupo, sesiones: lista }] : []
  })
}

/** Lo que se muestra cuando una sesión todavía no tiene título. */
export const TITULO_POR_DEFECTO = 'Conversación sin título'

const formatoHora = new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false })
const formatoDiaSemana = new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, weekday: 'short' })
const formatoFecha = new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, day: 'numeric', month: 'numeric' })

/** Cuándo, corto, para la fila de una sesión: "14:28", "ayer", "mar", "12/9". */
export function horaCorta(iso: string, ahora: Date): string {
  const fecha = new Date(iso)
  const dias = diasArgentinos(fecha, ahora)
  if (dias <= 0) return formatoHora.format(fecha)
  if (dias === 1) return 'ayer'
  if (dias < 7) return formatoDiaSemana.format(fecha).replace('.', '')
  return formatoFecha.format(fecha)
}
