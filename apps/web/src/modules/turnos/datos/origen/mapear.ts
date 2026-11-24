// De la API de reservas (lib/reservasApi) a los tipos con los que trabaja el
// panel de Turnos (datos/index.ts, datos/agenda.ts). Funciones puras, sin red:
// el origen de la API (api.ts) las usa y los tests las prueban solas.
//
// Las pantallas del panel no saben de la API: hablan de días contados desde
// hoy (`dia`, 0 = hoy), de minutos desde las 00:00, de días de la semana con
// el lunes en 0 y de estados en minúscula. La API habla de fechas AAAA-MM-DD de
// Argentina, del domingo en 0 y de estados en mayúscula. Acá se traduce.
import type { Bloqueo, Config, CrearBloqueo, GuardarConfig, GuardarRecurso, GuardarServicio, HorarioSemanal, Recurso as RecursoApi, Reserva, Servicio as ServicioApi, TipoRecurso, Tramo } from '@/lib/reservasApi/tipos'
import { diasEntre, sumarDias, fechaNumerica, type ISO } from '@/lib/reservas/fechas'
import { aMinutos, cruzar, diasAbiertos, diasTxt, hhmm, tramosDe, tramosDelDia, tramosTxt, type Semana } from '@/modules/turnos/horario'
import { COLORES_EQUIPO } from '@/modules/turnos/datos/equipo'
import { semanaDeRecurso, type Cliente, type EstadoTurno, type Recurso, type RubroTurnos } from '@/modules/turnos/datos'
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

/**
 * Un horario propio recortado al del negocio, día por día. La API no los cruza
 * (una agenda con horario propio usa solo el suyo), y el panel promete que el
 * propio va "dentro" del del negocio: si el negocio achica, se recorta acá.
 */
export function recortarHorario(propio: HorarioSemanal, negocio: HorarioSemanal): HorarioSemanal {
  const h: HorarioSemanal = {}
  for (let i = 0; i < 7; i++) {
    const clave = claveApi(i)
    const tramos = cruzar((propio[clave] ?? []) as Tramo[], (negocio[clave] ?? []) as Tramo[]) as Tramo[]
    if (tramos.length) h[clave] = tramos
  }
  return h
}

/** Si dos horarios abren igual todos los días. */
export function mismoHorario(a: HorarioSemanal, b: HorarioSemanal): boolean {
  for (let i = 0; i < 7; i++) {
    const clave = claveApi(i)
    if (!igualesTramos(a[clave] ?? [], b[clave] ?? [])) return false
  }
  return true
}

// ─── Feriados y vacaciones ───────────────────────────────────────────────────
//
// En la API son bloqueos generales (sin recurso): rangos en que no se reserva.
//   Cerrado todo el día   un bloqueo de 00:00 a 24:00
//   Otro horario          lo de antes y lo de después de ese horario
//   Vacaciones            un bloqueo de varios días, marcado en el motivo
// Un bloqueo solo saca horas: "otro horario" achica el día, no lo agranda. Lo
// que no tenga una de estas formas (de un solo recurso, un rato suelto) no se
// muestra ni se toca.

export interface DiaEspecial {
  id: string
  fecha: string
  motivo: string
  tipo: 'cerrado' | 'especial'
  rango: [string, string]
  /** Los bloqueos de la API que lo forman. Uno nuevo no tiene. */
  bloqueos?: string[]
}

export interface DiasCerrados {
  especiales: DiaEspecial[]
  vacaciones: boolean
  vacDesde: string
  vacHasta: string
  vacMensaje: string
  /** El bloqueo de las vacaciones guardadas. */
  vacBloqueo?: string
}

/** Con esto arranca el motivo del bloqueo de vacaciones; lo que sigue es el aviso del sitio. */
export const MARCA_VACACIONES = 'Vacaciones · '
const FIN_DEL_DIA = 1440
const RANGO_DE_FABRICA: [string, string] = ['09:00', '13:00']

/** Fecha y minuto de Argentina (UTC−3, sin horario de verano) de un instante de la API. */
function enArgentina(iso: string): { fecha: ISO; minuto: number } {
  const t = new Date(Date.parse(iso) - 3 * 3600_000).toISOString()
  return { fecha: t.slice(0, 10), minuto: Number(t.slice(11, 13)) * 60 + Number(t.slice(14, 16)) }
}

export function diasCerradosDeBloqueos(bloqueos: Bloqueo[]): DiasCerrados {
  const generales = bloqueos.filter(b => !b.recursoId)
  const vac = generales.find(b => b.motivo?.startsWith(MARCA_VACACIONES))
  const porDia = new Map<string, { b: Bloqueo; desde: number; hasta: number }[]>()
  for (const b of generales) {
    if (b === vac) continue
    const a = enArgentina(b.inicio)
    const z = enArgentina(b.fin)
    const hasta = z.fecha === a.fecha ? z.minuto : z.minuto === 0 && z.fecha === sumarDias(a.fecha, 1) ? FIN_DEL_DIA : null
    // Más de un día, o un rato en el medio: no es un feriado de esta pantalla.
    if (hasta === null || (a.minuto !== 0 && hasta !== FIN_DEL_DIA)) continue
    porDia.set(a.fecha, [...(porDia.get(a.fecha) ?? []), { b, desde: a.minuto, hasta }])
  }

  const especiales: DiaEspecial[] = []
  for (const [fecha, lista] of [...porDia].sort(([x], [y]) => x.localeCompare(y))) {
    const entero = lista.find(x => x.desde === 0 && x.hasta === FIN_DEL_DIA)
    if (entero) {
      especiales.push({ id: entero.b.id, fecha, motivo: entero.b.motivo ?? '', tipo: 'cerrado', rango: RANGO_DE_FABRICA, bloqueos: [entero.b.id] })
      continue
    }
    const antes = lista.find(x => x.desde === 0)
    const despues = lista.find(x => x.hasta === FIN_DEL_DIA)
    const partes = [antes, despues].filter((x): x is NonNullable<typeof x> => !!x)
    if (!partes.length || (antes && despues && antes.hasta >= despues.desde)) continue
    especiales.push({
      id: partes.map(x => x.b.id).join('+'), fecha, motivo: partes[0].b.motivo ?? '', tipo: 'especial',
      rango: [hhmm(antes?.hasta ?? 0), despues ? hhmm(despues.desde) : '23:59'],
      bloqueos: partes.map(x => x.b.id),
    })
  }

  if (!vac) return { especiales, vacaciones: false, vacDesde: '', vacHasta: '', vacMensaje: '' }
  const z = enArgentina(vac.fin)
  return {
    especiales, vacaciones: true, vacBloqueo: vac.id,
    vacDesde: enArgentina(vac.inicio).fecha,
    vacHasta: z.minuto === 0 ? sumarDias(z.fecha, -1) : z.fecha,
    vacMensaje: (vac.motivo ?? '').slice(MARCA_VACACIONES.length),
  }
}

/** Los bloqueos que forman un día especial. */
export function bloqueosDeDia(e: DiaEspecial): CrearBloqueo[] {
  const base = { modulo: 'TURNOS' as const, fechaDesde: e.fecha, ...(e.motivo.trim() ? { motivo: e.motivo.trim() } : {}) }
  if (e.tipo === 'cerrado') return [base]
  const desde = aMinutos(e.rango[0])
  const hasta = aMinutos(e.rango[1])
  return [
    ...(desde > 0 ? [{ ...base, minutoDesde: 0, minutoHasta: desde }] : []),
    ...(hasta < FIN_DEL_DIA ? [{ ...base, minutoDesde: hasta, minutoHasta: FIN_DEL_DIA }] : []),
  ]
}

export const bloqueoDeVacaciones = (v: DiasCerrados): CrearBloqueo => ({
  modulo: 'TURNOS', fechaDesde: v.vacDesde, fechaHasta: v.vacHasta, motivo: `${MARCA_VACACIONES}${v.vacMensaje.trim()}`,
})

/** Lo que distingue a un día especial: si cambia, se reemplazan sus bloqueos. */
export const claveDeDia = (e: DiaEspecial) => [e.fecha, e.motivo.trim(), e.tipo, e.tipo === 'especial' ? e.rango.join('-') : ''].join('|')
export const claveDeVacaciones = (v: DiasCerrados) => (v.vacaciones ? [v.vacDesde, v.vacHasta, v.vacMensaje.trim()].join('|') : '')

const fechaCorta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`

/** Qué impide guardar los días especiales y las vacaciones con esa semana, en palabras del panel. */
export function errorDiasCerrados(v: DiasCerrados, semana: Semana): { titulo: string; texto: string } | null {
  const vistas = new Set<string>()
  for (const e of v.especiales) {
    if (!e.fecha) return { titulo: 'Falta una fecha', texto: 'Elegí la fecha de cada día especial, o quitá el que no uses.' }
    const f = fechaCorta(e.fecha)
    if (vistas.has(e.fecha)) return { titulo: `El ${f} está dos veces`, texto: 'Dejá un solo renglón por día.' }
    vistas.add(e.fecha)
    if (e.tipo !== 'especial') continue
    const desde = aMinutos(e.rango[0])
    const hasta = aMinutos(e.rango[1])
    if (hasta <= desde) return { titulo: `Revisá el ${f}`, texto: 'La hora de cierre tiene que ser después de la de apertura.' }
    const tramos = tramosDelDia(semana, indicePanel(String(new Date(`${e.fecha}T12:00:00Z`).getUTCDay())))
    if (!tramos.length) return { titulo: `El ${f} no abrís`, texto: 'Otro horario solo achica un día que abre. Para abrir ese día, cambiá el horario semanal.' }
    const abre = tramos[0][0]
    const cierra = tramos[tramos.length - 1][1]
    if (desde < abre || hasta > cierra) return { titulo: `Revisá el ${f}`, texto: `Ese día abrís de ${hhmm(abre)} a ${hhmm(cierra)}: el otro horario tiene que estar adentro.` }
  }
  if (v.vacaciones) {
    if (!v.vacDesde || !v.vacHasta) return { titulo: 'Faltan las fechas de las vacaciones', texto: 'Elegí desde y hasta cuándo cerrás.' }
    if (v.vacHasta < v.vacDesde) return { titulo: 'Revisá las vacaciones', texto: 'La fecha de vuelta tiene que ser después de la de salida.' }
  }
  return null
}

// ─── Reglas de reserva ───────────────────────────────────────────────────────

/** Las reglas de la pantalla que la config de la API sabe guardar. */
export interface ReglasApi {
  minAnt: number
  maxAnt: number
  buffer: number
  confirmacion: 'auto' | 'manual'
  sena: boolean
  senaPct: number
  reprogramar: boolean
  reproHoras: number
  reproMax: number
  limite: number
  espera: boolean
  cancelaHasta: number
}

/**
 * La config como la pantalla. En la API "sin seña" es 0% y "sin reprogramar" es
 * 0 veces; la pantalla los lleva con su llave, y al prenderla propone un valor:
 * la seña típica del rubro y 2 veces.
 */
export const reglasDeConfig = (c: Config, senaDelRubro: number): ReglasApi => ({
  minAnt: c.anticipacionMinimaMinutos,
  maxAnt: c.anticipacionMaximaDias,
  buffer: c.margenMinutos,
  confirmacion: c.confirmacion === 'MANUAL' ? 'manual' : 'auto',
  sena: c.senaPorcentaje > 0,
  senaPct: c.senaPorcentaje || senaDelRubro || 30,
  reprogramar: c.reprogramacionesMaximas > 0,
  reproHoras: c.reprogramacionHastaHoras,
  reproMax: c.reprogramacionesMaximas || 2,
  limite: c.maximoActivasPorCliente,
  espera: c.listaDeEspera,
  cancelaHasta: c.cancelacionHastaHoras,
})

/** Lo que se manda al guardar. No lleva el horario: ese se guarda desde Horarios. */
export const configDeReglas = (r: ReglasApi): GuardarConfig => ({
  modulo: 'TURNOS',
  anticipacionMinimaMinutos: r.minAnt,
  anticipacionMaximaDias: r.maxAnt,
  margenMinutos: r.buffer,
  confirmacion: r.confirmacion === 'manual' ? 'MANUAL' : 'AUTOMATICA',
  senaPorcentaje: r.sena ? r.senaPct : 0,
  reprogramacionHastaHoras: r.reproHoras,
  reprogramacionesMaximas: r.reprogramar ? r.reproMax : 0,
  maximoActivasPorCliente: r.limite,
  listaDeEspera: r.espera,
  cancelacionHastaHoras: r.cancelaHasta,
})

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

/**
 * El horario de una agenda del panel como lo guarda la API: null si es el del
 * negocio (todos los días que abre, sin horario propio), así un cambio de
 * horario del negocio le llega sola. Si no, día por día lo que de verdad
 * atiende: el horario del negocio recortado a sus días y a su horario propio.
 */
export function horarioDeRecurso(r: Recurso, semana: Semana): HorarioSemanal | null {
  const abiertos = diasAbiertos(semana)
  const todos = abiertos.length === r.atiende.length && abiertos.every(d => r.atiende.includes(d))
  return !r.horario && todos ? null : horarioDeSemana(semanaDeRecurso(r, semana))
}

/**
 * Lo que se manda al crear o editar una agenda. El rol que se lee debajo del
 * nombre, el color y, si es de una persona, su rol del equipo van en `datos`:
 * la API no los tiene como campos. Turnos es de a uno: cupo 1.
 */
export function recursoParaApi(r: Recurso, rubro: RubroTurnos, semana: Semana, rolId?: string): GuardarRecurso {
  return {
    modulo: 'TURNOS', tipo: tipoDeAgenda(rubro), nombre: r.nombre, cupo: 1,
    horario: horarioDeRecurso(r, semana),
    datos: { rol: r.rol, color: r.color, ...(rolId ? { rolId } : {}) },
  }
}

/** El rol del equipo de quien es esa agenda, si el panel lo guardó. */
export const rolIdDeApi = (r: RecursoApi): string | null => (typeof r.datos?.rolId === 'string' ? r.datos.rolId : null)

/** Un servicio de la API como lo maneja el panel. Uno inactivo es uno pausado. */
export const servicioDeApi = (s: ServicioApi): ServicioBase => ({
  id: s.id, nombre: s.nombre, duracion: s.duracionMinutos, precio: s.precio, online: s.reservableOnline, ...(s.activo ? {} : { pausado: true }),
})

/** Lo que se manda al crear o editar un servicio: todos los campos que maneja el panel, así editar no deja nada viejo. */
export const servicioParaApi = (s: ServicioBase): GuardarServicio => ({
  modulo: 'TURNOS', nombre: s.nombre, duracionMinutos: s.duracion, precio: s.precio, reservableOnline: s.online, activo: !s.pausado,
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
