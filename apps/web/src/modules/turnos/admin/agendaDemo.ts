// DEMO — lo que el panel de Turnos necesita para funcionar sin backend: los
// tipos de lo que se edita en memoria, el calendario alrededor de hoy (la fecha
// real, de reloj.ts) y los turnos y los horarios libres de cada día. Todo vive
// en el estado de PanelTurnos: al recargar la página vuelve a los datos de ejemplo.
//
// La agenda sigue el horario del negocio (mañana y tarde, con el corte del
// mediodía) y, dentro de ese horario, los días y las horas de cada agenda: nada
// cae cuando el negocio está cerrado ni cuando esa persona no atiende.
import { useMemo } from 'react'
import { horaTxt, tramosDeRecurso, turnosDe, type ClaseCupo, type Recurso, type RubroTurnos, type ServicioTipo, type Turno } from '@/modules/turnos/datos'
import type { Semana, Tramo } from '@/modules/turnos/horario'
import * as reloj from '@/modules/turnos/reloj'

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

// ─── Calendario y turnos de cada día ────────────────────────────────────────
// En todo el panel un día se nombra por cuántos días faltan desde hoy (0 = hoy,
// -1 = ayer, 7 = dentro de una semana). Lo que traduce ese número a una fecha
// real depende del "ahora", así que viene armado por `calendarioDemo(ahora)` y
// los componentes lo toman con `useCalendarioDemo()`.

/** Las agendas del negocio de ejemplo: los turnos de muestra (datos.ts) son de r1, r2 y r3. */
const AGENDAS_EJEMPLO = ['r1', 'r2', 'r3']

export function calendarioDemo(ahora: reloj.Ahora) {
  const hoy = ahora.fecha
  /** La fecha real ("YYYY-MM-DD") de un día contado desde hoy. */
  const fechaDe = (dia: number) => reloj.sumarDias(hoy, dia)
  /** Los días que hay de hoy a una fecha. */
  const diaDesde = (f: reloj.Fecha) => reloj.diasEntre(hoy, f)
  /** 0 = lunes … 6 = domingo, igual que DIAS. */
  const indiceDia = (dia: number) => reloj.diaDeSemana(fechaDe(dia))
  const lunesDe = (dia: number) => dia - indiceDia(dia)
  /** El número del día en el mes (26 para el 26/09). */
  const numeroDia = (dia: number) => reloj.partesDe(fechaDe(dia)).dia
  const fechaLarga = (dia: number) => reloj.fechaLarga(fechaDe(dia))
  const fechaCorta = (dia: number) => reloj.fechaCorta(fechaDe(dia))
  /** "Semana del 21 al 26 de septiembre": del lunes al último día que se muestra. */
  const rangoSemana = (lunes: number, ultimo = 5) => `Semana ${reloj.rangoTxt(fechaDe(lunes), fechaDe(lunes + ultimo))}`
  const cuandoTxt = (dia: number) => (dia === 0 ? 'Hoy' : dia === 1 ? 'Mañana' : dia === -1 ? 'Ayer' : fechaLarga(dia))
  /** "Septiembre de 2026": el mes en el que cae ese día. */
  const mesTxt = (dia: number) => reloj.mesTxt(fechaDe(dia))
  const mismoMes = (a: number, b: number) => reloj.mismoMes(fechaDe(a), fechaDe(b))
  /** Los días del calendario del mes: semanas enteras, de lunes a domingo (trae días del mes anterior y del siguiente). */
  const grillaDelMes = (dia: number): number[] => reloj.grillaDelMes(fechaDe(dia)).map(diaDesde)
  /** El mismo día del mes, `pasos` meses más adelante (o atrás). Si ese mes es más corto, su último día. */
  const moverMes = (dia: number, pasos: number) => diaDesde(reloj.moverMes(fechaDe(dia), pasos))

  /**
   * Los turnos de ejemplo de un día. Se arman con el horario del negocio y con los
   * días y las horas de cada agenda tal como están AHORA en el panel: si el dueño
   * cambia el horario, o le saca la mañana a alguien, la agenda de muestra lo sigue.
   * Hoy es el día real (lo que ya pasó está atendido, lo que está pasando, en
   * curso). El resto de los días rota los mismos turnos para que la agenda tenga
   * una densidad creíble.
   */
  function turnosDelDia(rubro: RubroTurnos, recursos: Recurso[], semana: Semana, dia: number): TurnoAgenda[] {
    const d = indiceDia(dia)
    const jornadas = AGENDAS_EJEMPLO.map(id => {
      const r = recursos.find(x => x.id === id)
      return r ? tramosDeRecurso(r, semana, d) : []
    })
    const base = turnosDe(rubro, jornadas, dia === 0 ? ahora.minutos : null)
    if (dia === 0) return base.map(t => ({ ...t, dia }))
    const n = Math.abs(dia + 5)
    return base
      .filter((t, i) => (i + n) % 3 !== 0 && t.estado !== 'cancelado')
      .map(t => ({ ...t, id: `${t.id}.${dia}`, dia, estado: dia < 0 ? 'completado' as const : t.estado === 'pendiente' && dia < 3 ? 'pendiente' as const : 'confirmado' as const, nota: undefined }))
  }

  /** Horarios de inicio donde entra un turno de esa duración sin pisar a otro, dentro de los tramos en que esa agenda atiende ese día. */
  function horariosLibres(turnos: Turno[], tramos: Tramo[], recursoId: string, duracion: number, dia: number, salvo?: string) {
    if (dia < 0) return []
    const ocupados = turnos.filter(t => t.recursoId === recursoId && t.estado !== 'cancelado' && t.id !== salvo)
    const libres: number[] = []
    for (const [abre, cierra] of tramos) {
      for (let m = abre; m + duracion <= cierra; m += SLOT) {
        if (dia === 0 && m < ahora.minutos) continue
        if (!ocupados.some(t => m < t.inicio + t.duracion && m + duracion > t.inicio)) libres.push(m)
      }
    }
    return libres
  }

  /**
   * Los horarios libres de un día, agrupados como atiende esa agenda: la mañana y
   * la tarde, cada una con su rango. Si atiende de corrido todo el día, por
   * momento del día.
   */
  function libresPorTramo(turnos: Turno[], tramos: Tramo[], recursoId: string, duracion: number, dia: number, salvo?: string): GrupoLibres[] {
    const deCorrido = tramos.length === 1 && tramos[0][1] - tramos[0][0] > 6 * 60
    if (!deCorrido) return tramos.map(t => ({ nombre: momento(t[0]), rango: `${horaTxt(t[0])} a ${horaTxt(t[1])}`, libres: horariosLibres(turnos, [t], recursoId, duracion, dia, salvo) }))
    const todos = horariosLibres(turnos, tramos, recursoId, duracion, dia, salvo)
    return ([['Mañana', 0, 13 * 60], ['Tarde', 13 * 60, 19 * 60], ['Noche', 19 * 60, 24 * 60]] as const)
      .map(([nombre, a, b]) => ({ nombre, rango: '', libres: todos.filter(m => m >= a && m < b) }))
      .filter(g => g.libres.length > 0)
  }

  return {
    ahora, fechaDe, diaDesde, indiceDia, lunesDe, numeroDia, fechaLarga, fechaCorta, rangoSemana, cuandoTxt, mesTxt, mismoMes, grillaDelMes, moverMes,
    turnosDelDia, horariosLibres, libresPorTramo,
  }
}

export type CalendarioDemo = ReturnType<typeof calendarioDemo>

/** El calendario del panel con la hora real. Dentro de un <RelojTurnos>. */
export function useCalendarioDemo(): CalendarioDemo {
  const ahora = reloj.useReloj()
  return useMemo(() => calendarioDemo(ahora), [ahora])
}

/** A qué momento del día cae una hora: así se rotula cada turno de atención. */
export const momento = (m: number): 'Mañana' | 'Tarde' | 'Noche' => (m < 12 * 60 ? 'Mañana' : m < 19 * 60 ? 'Tarde' : 'Noche')

export interface GrupoLibres { nombre: 'Mañana' | 'Tarde' | 'Noche'; /** "09:00 a 13:00" si es un turno de atención. */ rango: string; libres: number[] }

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
