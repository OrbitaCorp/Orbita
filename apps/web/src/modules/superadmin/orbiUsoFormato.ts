import type { OrbiCaracteresDelContexto, OrbiPasoDelTurno, OrbiToolDelPaso } from '@/lib/platform/api'

// Formateo y lectura pura de la pestaña Orbi → Uso del super panel
// (OrbiUso.tsx). Acá no hay React ni red: todo se prueba en orbiUsoFormato.test.ts.
// No se llama orbiUso.ts: en Windows (sistema de archivos sin mayúsculas)
// chocaría con OrbiUso.tsx, el mismo problema que markdown.ts vs Markdown.tsx.

// Debajo de 10 centavos se ven 4 decimales: un mensaje cuesta fracciones de
// centavo y con 2 decimales todo daría "USD 0,00".
export const usd = (n: number | null | undefined) => (n == null ? '—' : `USD ${n.toLocaleString('es-AR', { minimumFractionDigits: n < 0.1 ? 4 : 2, maximumFractionDigits: n < 0.1 ? 4 : 2 })}`)
/** Eje Y del costo diario: corto y sin "USD" (lo dice el título), para no comerse el ancho del gráfico. */
export const usdEje = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: Math.abs(n) < 1 ? 3 : 1 })
export const tokens = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('es-AR'))
export const ms = (n: number | null | undefined) => (n == null ? '—' : n < 1000 ? `${Math.round(n)} ms` : `${(n / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} s`)
export const etiquetaDeTools = (t: string) => (t ? t : 'Charla, sin tools')
export const pct = (n: number | null | undefined) => (n == null ? '—' : `${Math.round(n)} %`)

/** Qué parte de `total` es `parte`, en %. Sin total no hay porcentaje (no un 0 que engañe). */
export function porcentajeDe(parte: number, total: number): number | null {
  return total > 0 ? (parte / total) * 100 : null
}

/**
 * Si el formulario de "Abrir conversación" ya tiene algo cargado: mientras lo
 * tenga, un clic afuera no cierra el modal (se perdería lo escrito).
 */
export function lecturaEmpezada(f: { motivo: string | null; detalle: string; ticket: string }): boolean {
  return f.motivo !== null || f.detalle.trim() !== '' || f.ticket.trim() !== ''
}

/** El cupo se marca en rojo desde el 100 %: ahí, con el bloqueo prendido, Orbi deja de contestar. */
export const excedido = (porcentaje: number) => porcentaje >= 100

export function mesesRecientes(ahora: Date, cuantos = 6): string[] {
  const out: string[] = []
  const d = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1))
  for (let i = 0; i < cuantos; i++) { out.push(d.toISOString().slice(0, 7)); d.setUTCMonth(d.getUTCMonth() - 1) }
  return out
}

/**
 * `ahora` corrido a la hora de Argentina (UTC-3, sin horario de verano), para
 * pasárselo a mesesRecientes: el backend cuenta los meses en hora argentina y
 * el 1/11 a la 01:00 UTC todavía es octubre allá.
 */
export function mesActualArgentina(ahora: Date): Date {
  return new Date(ahora.getTime() - 3 * 60 * 60 * 1000)
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
/** '2026-10' → 'octubre 2026'. A mano y no con toLocaleDateString: así no depende del huso ni de la versión de ICU. */
export function etiquetaDeMes(mes: string): string {
  const [anio, m] = mes.split('-')
  return `${MESES[Number(m) - 1] ?? m} ${anio}`
}

/**
 * Créditos de un ajuste de cupo: entero con signo (+ suma, - resta), distinto
 * de cero. null = no es un ajuste válido. El backend exige lo mismo (IsInt).
 */
export function leerCreditos(texto: string): number | null {
  const t = texto.trim()
  if (!/^[+-]?\d+$/.test(t)) return null
  const n = Number.parseInt(t, 10)
  return n === 0 || !Number.isSafeInteger(n) ? null : n
}

// steps y contextChars llegan como Json de la base (`unknown` en el contrato):
// las filas viejas no los tienen y una forma rota no tiene que voltear la
// pantalla. Se lee lo que tiene forma y lo demás se descarta.
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const esObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const TIPOS_DE_TOOL: OrbiToolDelPaso['tipo'][] = ['lectura', 'propuesta', 'rechazada']

export function pasosDe(steps: unknown): OrbiPasoDelTurno[] {
  if (!Array.isArray(steps)) return []
  return steps.filter(esObjeto).filter((s) => num(s.n) !== null).map((s) => ({
    n: num(s.n) as number,
    provider: str(s.provider),
    model: str(s.model),
    promptTokens: num(s.promptTokens),
    cachedTokens: num(s.cachedTokens),
    completionTokens: num(s.completionTokens),
    thinkingTokens: num(s.thinkingTokens),
    ms: num(s.ms) ?? 0,
    tools: (Array.isArray(s.tools) ? s.tools : [])
      .filter(esObjeto)
      .filter((t) => typeof t.name === 'string' && TIPOS_DE_TOOL.includes(t.tipo as OrbiToolDelPaso['tipo']))
      .map((t) => ({ name: t.name as string, tipo: t.tipo as OrbiToolDelPaso['tipo'], ms: num(t.ms) ?? 0, ok: t.ok === true })),
  }))
}

export function contextoDe(c: unknown): OrbiCaracteresDelContexto | null {
  if (!esObjeto(c)) return null
  const system = num(c.system), toolsC = num(c.tools), history = num(c.history), message = num(c.message)
  if (system === null || toolsC === null || history === null || message === null) return null
  return { system, tools: toolsC, history, message }
}

// Los status que escribe orbi-turn.service.ts (EstadoDelTurno). El color
// acompaña, el texto es el que dice qué pasó.
type Tono = 'green' | 'amber' | 'red' | 'gray'
const ESTADOS: Record<string, { label: string; tone: Tono }> = {
  ok: { label: 'Respondió', tone: 'green' },
  error: { label: 'Error', tone: 'red' },
  cancelled: { label: 'Cancelado', tone: 'gray' },
  max_rounds: { label: 'Tope de vueltas', tone: 'amber' },
  quota: { label: 'Frenado por cupo', tone: 'amber' },
}
export function estadoDelTurno(status: string): { label: string; tone: Tono } {
  return ESTADOS[status] ?? { label: status, tone: 'gray' }
}

/**
 * La serie del backend trae días 'AAAA-MM-DD' de Argentina. El gráfico los
 * pasa por `new Date()`: a medianoche UTC se dibujarían un día antes en
 * Argentina, así que van a mediodía UTC (mismo día en cualquier huso).
 */
export function puntosDeSerie(serie: { dia: string; mensajes: number; costoUsd: number }[]): { date: string; mensajes: number; costo: number }[] {
  return serie.map((s) => ({ date: `${s.dia}T12:00:00Z`, mensajes: s.mensajes, costo: s.costoUsd }))
}
