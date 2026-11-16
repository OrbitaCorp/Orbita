// De la API de reservas (lib/reservasApi) a los tipos con los que trabaja el
// panel de Turnos (datos/index.ts, datos/agenda.ts). Funciones puras, sin red:
// el origen de la API (api.ts) las usa y los tests las prueban solas.
//
// Las pantallas del panel no saben de la API: hablan de días contados desde
// hoy (`dia`, 0 = hoy), de minutos desde las 00:00, de días de la semana con
// el lunes en 0 y de estados en minúscula. La API habla de fechas AAAA-MM-DD de
// Argentina, del domingo en 0 y de estados en mayúscula. Acá se traduce.
import type { HorarioSemanal, Recurso as RecursoApi, Reserva, Servicio as ServicioApi, TipoRecurso, Tramo } from '@/lib/reservasApi/tipos'
import { diasEntre, sumarDias, fechaNumerica, type ISO } from '@/lib/reservas/fechas'
import { diasAbiertos, diasTxt, tramosDe, tramosTxt, type Semana } from '@/modules/turnos/horario'
import { COLORES_EQUIPO } from '@/modules/turnos/datos/equipo'
import type { Cliente, EstadoTurno, Recurso, RubroTurnos } from '@/modules/turnos/datos'
import type { ServicioBase, TurnoAgenda } from '@/modules/turnos/datos/agenda'

const NOMBRES_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// ─── Días y fechas ───────────────────────────────────────────────────────────

/** La clave de la API (0 = domingo) para un día del panel (0 = lunes). */
export const claveApi = (indice: number) => String((indice + 1) % 7) as keyof HorarioSemanal
/** El día del panel (0 = lunes) para una clave de la API (0 = domingo). */
export const indicePanel = (clave: string) => (Number(clave) + 6) % 7

/** `dia` del panel (días desde hoy) para una fecha de la API. */
export const diaDe = (fecha: ISO, hoy: ISO) => diasEntre(hoy, fecha)
/** La fecha de la API para un `dia` del panel. */
export const fechaDe = (dia: number, hoy: ISO) => sumarDias(hoy, dia)

/** Hoy en Argentina (AAAA-MM-DD) y los minutos desde sus 00:00. */
export function ahoraArgentina(ahora = new Date()): { hoy: ISO; minutos: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(ahora).map(x => [x.type, x.value]),
  )
  return { hoy: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute) }
}

// ─── Horarios ────────────────────────────────────────────────────────────────

/** El horario semanal de la API como la semana del panel: siete renglones de lunes a domingo, '' = cerrado. */
export function semanaDeHorario(h: HorarioSemanal | null | undefined): Semana {
  return NOMBRES_DIA.map((nombre, i) => [nombre, tramosTxt(h?.[claveApi(i)] ?? [])])
}

/** La semana del panel como horario de la API. Los días cerrados no van. */
export function horarioDeSemana(semana: Semana): HorarioSemanal {
  const h: HorarioSemanal = {}
  semana.forEach(([, texto], i) => {
    const tramos = tramosDe(texto) as Tramo[]
    if (tramos.length) h[claveApi(i)] = tramos
  })
  return h
}

const igualesTramos = (a: readonly Tramo[], b: readonly Tramo[]) => a.length === b.length && a.every((t, i) => t[0] === b[i][0] && t[1] === b[i][1])

/**
 * Los días y el horario de una agenda con el modelo del panel: qué días atiende
 * y, si no es el del negocio, UN horario propio en texto. La API guarda un
 * horario por día; el panel, uno solo para todos los días que atiende. Si los
 * días tienen horarios distintos se toma el del primero: lo que el panel puede
 * mostrar hoy (queda registrado en el mapa de Turnos).
 */
export function agendaDeHorario(propio: HorarioSemanal | null, semana: Semana): Pick<Recurso, 'atiende' | 'horario' | 'dias'> {
  if (!propio) {
    const atiende = diasAbiertos(semana)
    return { atiende, horario: '', dias: diasTxt(atiende) }
  }
  const atiende: number[] = []
  for (let i = 0; i < 7; i++) if (propio[claveApi(i)]?.length) atiende.push(i)
  const delNegocio = atiende.every(i => igualesTramos(propio[claveApi(i)] ?? [], tramosDe(semana[i]?.[1]) as Tramo[]))
  const primero = atiende.length ? propio[claveApi(atiende[0])] ?? [] : []
  return { atiende, horario: delNegocio ? '' : tramosTxt(primero), dias: diasTxt(atiende) }
}

// ─── Catálogo ────────────────────────────────────────────────────────────────

/** El tipo de recurso que es una columna de la agenda en este rubro. */
export const tipoDeAgenda = (rubro: RubroTurnos): TipoRecurso => (rubro.modo === 'profesional' ? 'PROFESIONAL' : 'ESPACIO')

/**
 * Un recurso de la API como agenda del panel. El rol que se lee debajo del
 * nombre y el color de la columna van en `datos` (rol, color): la API no los
 * tiene como campos propios.
 */
export function recursoDeApi(r: RecursoApi, rubro: RubroTurnos, semana: Semana, i: number): Recurso {
  const rol = typeof r.datos?.rol === 'string' ? r.datos.rol : r.tipo === 'PROFESIONAL' ? rubro.profesional : 'Espacio'
  const color = typeof r.datos?.color === 'string' ? r.datos.color : COLORES_EQUIPO[i % COLORES_EQUIPO.length]
  return { id: r.id, nombre: r.nombre, rol, color, ...agendaDeHorario(r.horario, semana) }
}

/** Un servicio de la API como lo maneja el panel. Uno inactivo es uno pausado. */
export const servicioDeApi = (s: ServicioApi): ServicioBase => ({
  id: s.id, nombre: s.nombre, duracion: s.duracionMinutos, precio: s.precio, online: s.reservableOnline, ...(s.activo ? {} : { pausado: true }),
})

// ─── Agenda ──────────────────────────────────────────────────────────────────

/**
 * Quién reservó: la ficha de cliente si la hay; si no (reservó sin cuenta), su
 * teléfono, su email o, en el último caso, la reserva misma. Así dos reservas
 * de la misma persona caen en el mismo cliente aunque no tenga ficha.
 */
export function clienteKey(r: Pick<Reserva, 'id' | 'clienteId' | 'clienteTelefono' | 'clienteEmail'>): string {
  if (r.clienteId) return r.clienteId
  const tel = (r.clienteTelefono ?? '').replace(/\D/g, '')
  if (tel.length >= 6) return `tel:${tel}`
  if (r.clienteEmail) return `mail:${r.clienteEmail.toLowerCase()}`
  return `reserva:${r.id}`
}

/**
 * El estado de la API como estado del panel. VENCIDA no se muestra (fue un
 * lugar retenido que nadie confirmó). RETENIDA y PENDIENTE van como "Sin
 * confirmar". Una confirmada que está pasando ahora es "En curso".
 */
export function estadoDeApi(r: Pick<Reserva, 'estado' | 'fecha' | 'inicioMinutos' | 'finMinutos'>, hoy: ISO, minutos: number): EstadoTurno | null {
  switch (r.estado) {
    case 'VENCIDA': return null
    case 'RETENIDA':
    case 'PENDIENTE': return 'pendiente'
    case 'CONFIRMADA': return r.fecha === hoy && r.inicioMinutos <= minutos && minutos < r.finMinutos ? 'en-curso' : 'confirmado'
    case 'COMPLETADA': return 'completado'
    case 'AUSENTE': return 'ausente'
    case 'CANCELADA': return 'cancelado'
  }
}

/** Una reserva de la API como turno de la agenda del panel, o null si no se muestra. */
export function turnoDeApi(r: Reserva, hoy: ISO, minutos: number): TurnoAgenda | null {
  const estado = estadoDeApi(r, hoy, minutos)
  if (!estado) return null
  const nota = r.notaInterna ?? r.notas ?? undefined
  return {
    id: r.id,
    recursoId: r.recursoId,
    clienteId: clienteKey(r),
    servicio: r.servicio?.nombre ?? 'Turno',
    inicio: r.inicioMinutos,
    duracion: r.finMinutos - r.inicioMinutos,
    precio: r.precio,
    estado,
    senaPagada: r.sena <= 0 || r.pagado >= r.sena,
    ...(nota ? { nota } : {}),
    dia: diaDe(r.fecha, hoy),
  }
}

/** Los turnos agrupados por `dia`, cada día ordenado por hora. */
export function porDia(reservas: Reserva[], hoy: ISO, minutos: number): Map<number, TurnoAgenda[]> {
  const dias = new Map<number, TurnoAgenda[]>()
  for (const r of reservas) {
    const t = turnoDeApi(r, hoy, minutos)
    if (!t) continue
    const lista = dias.get(t.dia ?? 0)
    if (lista) lista.push(t)
    else dias.set(t.dia ?? 0, [t])
  }
  for (const lista of dias.values()) lista.sort((a, b) => a.inicio - b.inicio)
  return dias
}

/**
 * Los clientes que salen de las reservas: uno por persona (clienteKey), con
 * sus visitas (turnos atendidos), la última y lo que gastó (lo cobrado en
 * esos turnos). El nombre y el teléfono, los de su reserva más nueva.
 */
export function clientesDeReservas(reservas: Reserva[]): Cliente[] {
  const porCliente = new Map<string, Reserva[]>()
  for (const r of reservas) {
    if (r.estado === 'VENCIDA') continue
    const k = clienteKey(r)
    porCliente.set(k, [...(porCliente.get(k) ?? []), r])
  }
  return [...porCliente.entries()].map(([id, lista]) => {
    const nueva = lista.reduce((a, b) => (a.creadaEn > b.creadaEn ? a : b))
    const atendidas = lista.filter(r => r.estado === 'COMPLETADA')
    const ultima = atendidas.reduce<string | null>((f, r) => (!f || r.fecha > f ? r.fecha : f), null)
    return {
      id,
      nombre: nueva.clienteNombre || 'Sin nombre',
      telefono: nueva.clienteTelefono || 'Sin teléfono',
      visitas: atendidas.length,
      ultima: ultima ? fechaNumerica(ultima) : '—',
      gastado: atendidas.reduce((s, r) => s + r.pagado, 0),
    }
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}
