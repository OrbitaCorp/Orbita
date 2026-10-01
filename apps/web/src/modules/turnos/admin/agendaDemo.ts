// DEMO — lo que el panel de Turnos necesita para funcionar sin backend: los
// tipos de lo que se edita en memoria, el calendario alrededor del día de la
// demo (sábado 26/09) y los turnos y los horarios libres de cada día. Todo vive
// en el estado de PanelTurnos: al recargar la página vuelve a los datos de ejemplo.
//
// La agenda sigue el horario del negocio (mañana y tarde, con el corte del
// mediodía) y, dentro de ese horario, los días y las horas de cada agenda: nada
// cae cuando el negocio está cerrado ni cuando esa persona no atiende.
import { DIAS, horaTxt, tramosDeRecurso, turnosDe, type ClaseCupo, type Recurso, type RubroTurnos, type ServicioTipo, type Turno } from '@/modules/turnos/datos'
import { AHORA_DEMO, type Semana, type Tramo } from '@/modules/turnos/horario'

/** Turno con su día: `dia` son los días contados desde hoy (0 = hoy, -1 = ayer). */
export type TurnoAgenda = Turno & { dia?: number }
export type ServicioPanel = ServicioTipo & { id: string; online: boolean }
/** `lista` son los anotados con nombre; mientras nadie la toca se arma de ejemplo. */
export type ClasePanel = ClaseCupo & { lista?: string[] }

/** Con qué arranca el formulario de "Nuevo turno" según desde dónde se abre. */
export interface NuevoTurnoPre { clienteId?: string; recursoId?: string; inicio?: number; dia?: number }
/**
 * Mensaje de WhatsApp de la demo. Con `para` va a una persona y el envío se
 * simula (nunca se abre WhatsApp con un teléfono de la demo: son inventados y
 * podrían ser de alguien real). Sin `para` es para compartir: copiar o el menú
 * de compartir del sistema, y el dueño elige adónde.
 */
export interface MensajeWA { titulo: string; para?: string; telefono?: string; texto: string }

export type Avisar = (titulo: string, descripcion?: string) => void

export const SLOT = 30

// ─── Calendario ───────────────────────────────────────────────────────────────

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MS_DIA = 24 * 60 * 60 * 1000

export const fechaDe = (dia: number) => new Date(2026, 8, 26 + dia)
/** Los días que hay de hoy (la fecha de la demo) a una fecha. */
const diaDesde = (f: Date) => Math.round((f.getTime() - fechaDe(0).getTime()) / MS_DIA)
/** 0 = lunes … 6 = domingo, igual que DIAS. */
export const indiceDia = (dia: number) => (fechaDe(dia).getDay() + 6) % 7
export const lunesDe = (dia: number) => dia - indiceDia(dia)

export function fechaLarga(dia: number) {
  const f = fechaDe(dia)
  return `${DIAS[indiceDia(dia)]} ${f.getDate()} de ${MESES[f.getMonth()]}`
}
export function fechaCorta(dia: number) {
  const f = fechaDe(dia)
  return `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}`
}
/** "Semana del 21 al 26 de septiembre": del lunes al último día que se muestra. */
export function rangoSemana(lunes: number, ultimo = 5) {
  const a = fechaDe(lunes), b = fechaDe(lunes + ultimo)
  return a.getMonth() === b.getMonth()
    ? `Semana del ${a.getDate()} al ${b.getDate()} de ${MESES[b.getMonth()]}`
    : `Semana del ${a.getDate()} de ${MESES[a.getMonth()]} al ${b.getDate()} de ${MESES[b.getMonth()]}`
}
export const cuandoTxt = (dia: number) => (dia === 0 ? 'Hoy' : dia === 1 ? 'Mañana' : dia === -1 ? 'Ayer' : fechaLarga(dia))

/** "Septiembre de 2026": el mes en el que cae ese día. */
export function mesTxt(dia: number) {
  const f = fechaDe(dia)
  const m = MESES[f.getMonth()]
  return `${m[0].toUpperCase()}${m.slice(1)} de ${f.getFullYear()}`
}
export const mismoMes = (a: number, b: number) => fechaDe(a).getMonth() === fechaDe(b).getMonth() && fechaDe(a).getFullYear() === fechaDe(b).getFullYear()
/** Los días del calendario del mes: semanas enteras, de lunes a domingo (trae días del mes anterior y del siguiente). */
export function grillaDelMes(dia: number): number[] {
  const f = fechaDe(dia)
  const desde = lunesDe(diaDesde(new Date(f.getFullYear(), f.getMonth(), 1)))
  const hasta = lunesDe(diaDesde(new Date(f.getFullYear(), f.getMonth() + 1, 0))) + 6
  return Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i)
}
/** El mismo día del mes, `pasos` meses más adelante (o atrás). Si ese mes es más corto, su último día. */
export function moverMes(dia: number, pasos: number) {
  const f = fechaDe(dia)
  const tope = new Date(f.getFullYear(), f.getMonth() + pasos + 1, 0).getDate()
  return diaDesde(new Date(f.getFullYear(), f.getMonth() + pasos, Math.min(f.getDate(), tope)))
}

// ─── Turnos de cada día ───────────────────────────────────────────────────────

/** Las agendas del negocio de ejemplo: los turnos de muestra (datos.ts) son de r1, r2 y r3. */
const AGENDAS_EJEMPLO = ['r1', 'r2', 'r3']

/**
 * Los turnos de ejemplo de un día. Se arman con el horario del negocio y con los
 * días y las horas de cada agenda tal como están AHORA en el panel: si el dueño
 * cambia el horario, o le saca la mañana a alguien, la agenda de muestra lo sigue.
 * Hoy es el día real de la demo (lo que ya pasó está atendido, lo que está
 * pasando, en curso). El resto de los días rota los mismos turnos para que la
 * agenda tenga una densidad creíble.
 */
export function turnosDelDia(rubro: RubroTurnos, recursos: Recurso[], semana: Semana, dia: number): TurnoAgenda[] {
  const d = indiceDia(dia)
  const jornadas = AGENDAS_EJEMPLO.map(id => {
    const r = recursos.find(x => x.id === id)
    return r ? tramosDeRecurso(r, semana, d) : []
  })
  const base = turnosDe(rubro, jornadas, dia === 0 ? AHORA_DEMO : null)
  if (dia === 0) return base.map(t => ({ ...t, dia }))
  const n = Math.abs(dia + 5)
  return base
    .filter((t, i) => (i + n) % 3 !== 0 && t.estado !== 'cancelado')
    .map(t => ({ ...t, id: `${t.id}.${dia}`, dia, estado: dia < 0 ? 'completado' as const : t.estado === 'pendiente' && dia < 3 ? 'pendiente' as const : 'confirmado' as const, nota: undefined }))
}

/** Horarios de inicio donde entra un turno de esa duración sin pisar a otro, dentro de los tramos en que esa agenda atiende ese día. */
export function horariosLibres(turnos: Turno[], tramos: Tramo[], recursoId: string, duracion: number, dia: number, salvo?: string) {
  if (dia < 0) return []
  const ocupados = turnos.filter(t => t.recursoId === recursoId && t.estado !== 'cancelado' && t.id !== salvo)
  const libres: number[] = []
  for (const [abre, cierra] of tramos) {
    for (let m = abre; m + duracion <= cierra; m += SLOT) {
      if (dia === 0 && m < AHORA_DEMO) continue
      if (!ocupados.some(t => m < t.inicio + t.duracion && m + duracion > t.inicio)) libres.push(m)
    }
  }
  return libres
}

/** A qué momento del día cae una hora: así se rotula cada turno de atención. */
export const momento = (m: number): 'Mañana' | 'Tarde' | 'Noche' => (m < 12 * 60 ? 'Mañana' : m < 19 * 60 ? 'Tarde' : 'Noche')

export interface GrupoLibres { nombre: 'Mañana' | 'Tarde' | 'Noche'; /** "09:00 a 13:00" si es un turno de atención. */ rango: string; libres: number[] }

/**
 * Los horarios libres de un día, agrupados como atiende esa agenda: la mañana y
 * la tarde, cada una con su rango. Si atiende de corrido todo el día, por
 * momento del día.
 */
export function libresPorTramo(turnos: Turno[], tramos: Tramo[], recursoId: string, duracion: number, dia: number, salvo?: string): GrupoLibres[] {
  const deCorrido = tramos.length === 1 && tramos[0][1] - tramos[0][0] > 6 * 60
  if (!deCorrido) return tramos.map(t => ({ nombre: momento(t[0]), rango: `${horaTxt(t[0])} a ${horaTxt(t[1])}`, libres: horariosLibres(turnos, [t], recursoId, duracion, dia, salvo) }))
  const todos = horariosLibres(turnos, tramos, recursoId, duracion, dia, salvo)
  return ([['Mañana', 0, 13 * 60], ['Tarde', 13 * 60, 19 * 60], ['Noche', 19 * 60, 24 * 60]] as const)
    .map(([nombre, a, b]) => ({ nombre, rango: '', libres: todos.filter(m => m >= a && m < b) }))
    .filter(g => g.libres.length > 0)
}

/** Bloques de media hora sin turno, dentro de los tramos en que esa agenda atiende. */
export function huecosDe(turnos: Turno[], tramos: Tramo[], recursoId: string) {
  const ocupados = turnos.filter(t => t.recursoId === recursoId && t.estado !== 'cancelado')
  const libres: number[] = []
  for (const [abre, cierra] of tramos) {
    for (let m = abre; m + SLOT <= cierra; m += SLOT) {
      if (!ocupados.some(t => m < t.inicio + t.duracion && m + SLOT > t.inicio)) libres.push(m)
    }
  }
  return libres
}

// ─── Navegador ────────────────────────────────────────────────────────────────

/** Copia al portapapeles. Devuelve si pudo (en http o sin permiso, prueba el método viejo). */
export async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    const t = document.createElement('textarea')
    t.value = texto
    t.setAttribute('readonly', '')
    t.style.position = 'fixed'
    t.style.opacity = '0'
    document.body.appendChild(t)
    t.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    document.body.removeChild(t)
    return ok
  }
}

export const tieneTelefono = (telefono?: string) => (telefono ?? '').replace(/\D/g, '').length >= 8

/** Para buscar sin que importen los acentos ni las mayúsculas ("ramirez" encuentra "Ramírez"). */
export const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
