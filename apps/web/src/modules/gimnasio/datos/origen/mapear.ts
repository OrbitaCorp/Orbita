// De la API de reservas (lib/reservasApi) a los tipos con los que trabaja el
// panel de Gimnasio (datos/index.ts), y de vuelta. Funciones puras, sin red: el
// origen de la API (api.ts) las usa y los tests las prueban solas.
//
// Cómo vive Gimnasio en el motor compartido:
// - Cada clase de la grilla es un recurso CLASE con UNA sesión semanal: su
//   horario es { día: [[inicio, fin]] }, su cupo el de la clase y su duración
//   la de la actividad. Así cada clase tiene su cupo, su profe y su sala, como
//   en la demo. Si alguien carga por la API un recurso con varias sesiones,
//   cada sesión se ve como una clase (y comparten cupo, profe y sala).
// - Lo propio de Gimnasio va en `datos.gimnasio` del recurso: la actividad (id
//   y color), el profe (id y nombre) y la sala. La API todavía no tiene
//   actividades, salas ni equipo de Gimnasio: se arman con lo que dicen las
//   clases (lo decide la tarea del 16/11, junto con planes, pases y alumnos).
// - Cada reserva es una inscripción y cada persona en la lista de espera, una
//   inscripción en estado 'espera'. Los socios salen de esas mismas filas, uno
//   por persona (su ficha, su celular o su email), hasta que los alumnos
//   tengan su lugar en la API. Cada inscripción conserva el nombre con el que
//   se anotó: dos personas con el mismo celular comparten ficha (una madre que
//   anota a sus dos hijos) y en la clase cada lugar se ve con su nombre.
// - Los días: la API cuenta el domingo como 0; el panel, el lunes. Las horas
//   son minutos de Argentina en los dos.
import type { AnotarseEnEspera, Bloqueo, Cliente, Config, CrearBloqueo, CrearDesdePanel, Espera, GuardarRecurso, HorarioSemanal, Recurso, Reserva, Tramo } from '@/lib/reservasApi/tipos'
import { diaSemana, sumarDias, type ISO } from '@/lib/reservas/fechas'
import { COLORES_ACTIVIDAD, colorDe, lugaresDe, type Actividad, type Apertura, type BloqueoGym, type ClaseSemanal, type EstadoInscripcion, type Inscripcion, type NegocioGym, type Profe, type Socio } from '../index'
import { relojArgentina } from '../reloj'

export const MODULO = 'GIMNASIO' as const
const CLAVES = ['0', '1', '2', '3', '4', '5', '6'] as const

// ─── Días ────────────────────────────────────────────────────────────────────

/** La clave de la API (0 = domingo) para un día del panel (0 = lunes). */
export const claveApi = (dia: number) => String((dia + 1) % 7) as keyof HorarioSemanal
/** El día del panel (0 = lunes) para una clave de la API (0 = domingo). */
export const diaPanel = (clave: string | number) => (Number(clave) + 6) % 7

// ─── Lo de Gimnasio adentro del recurso ──────────────────────────────────────

/** Lo que viaja en `datos.gimnasio` de cada recurso CLASE. */
export interface DatosGimnasio {
  actividadId: string
  /** El color de la actividad en la grilla. */
  color: string
  /** '' = la clase está sin profe. */
  profeId: string
  profe: string
  sala: string
}

const texto = (v: unknown) => (typeof v === 'string' ? v : '')
const slug = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Lo de Gimnasio que trae un recurso. Uno cargado por fuera del panel (sin `datos.gimnasio`) agrupa su actividad por el nombre. */
export function datosGimnasio(r: Pick<Recurso, 'nombre' | 'datos'>): DatosGimnasio {
  const crudo = r.datos?.gimnasio
  const g = (crudo && typeof crudo === 'object' ? crudo : {}) as Record<string, unknown>
  return {
    actividadId: texto(g.actividadId) || `act-${slug(r.nombre) || 'clase'}`,
    color: texto(g.color),
    profeId: texto(g.profeId),
    profe: texto(g.profe),
    sala: texto(g.sala),
  }
}

// ─── Sesiones y clases ───────────────────────────────────────────────────────

export interface Sesion { dia: number; inicio: number; fin: number }

/** Las sesiones (o los tramos) de un horario semanal, de lunes a domingo y por hora. */
export function sesionesDe(h: HorarioSemanal | null | undefined): Sesion[] {
  if (!h) return []
  const out: Sesion[] = []
  for (const clave of CLAVES) for (const [inicio, fin] of h[clave] ?? []) out.push({ dia: diaPanel(clave), inicio, fin })
  return out.sort((a, b) => a.dia - b.dia || a.inicio - b.inicio)
}

const SEP = '~'
/** El id de una clase de la grilla: el del recurso si tiene una sola sesión; si tiene varias, recurso~día-hora. */
export const idDeClase = (recursoId: string, s: Pick<Sesion, 'dia' | 'inicio'>, unica: boolean) => (unica ? recursoId : `${recursoId}${SEP}${s.dia}-${s.inicio}`)
/** El recurso de la API que guarda una clase de la grilla. */
export const recursoDeClase = (claseId: string) => claseId.split(SEP)[0]

/** Las clases de la grilla que salen de un recurso: una por sesión. */
export function clasesDeRecurso(r: Recurso): ClaseSemanal[] {
  const g = datosGimnasio(r)
  const sesiones = sesionesDe(r.horario)
  return sesiones.map(s => ({ id: idDeClase(r.id, s, sesiones.length === 1), actividadId: g.actividadId, dia: s.dia, inicio: s.inicio, profeId: g.profeId, sala: g.sala, cupo: r.cupo }))
}

/** Las actividades que dictan las clases, en el orden de la grilla. La duración y el cupo, los de su primera clase. */
export function actividadesDe(recursos: Recurso[]): Actividad[] {
  const por = new Map<string, Actividad>()
  for (const r of recursos) {
    const g = datosGimnasio(r)
    if (por.has(g.actividadId)) continue
    por.set(g.actividadId, { id: g.actividadId, nombre: r.nombre, duracion: r.duracionMinutos ?? 60, cupo: r.cupo, color: g.color || COLORES_ACTIVIDAD[por.size % COLORES_ACTIVIDAD.length] })
  }
  return [...por.values()]
}

/** Las salas en que hay clases, sin repetir. */
export const salasDe = (recursos: Recurso[]): string[] => [...new Set(recursos.map(r => datosGimnasio(r).sala).filter(Boolean))]

/** Quienes dan las clases, con las actividades que dictan. El color, fijo por nombre (como las siglas de los socios). */
export function profesDe(recursos: Recurso[]): Profe[] {
  const por = new Map<string, Profe>()
  for (const r of recursos) {
    const g = datosGimnasio(r)
    if (!g.profeId) continue
    const p = por.get(g.profeId) ?? { id: g.profeId, nombre: g.profe || 'Profe', color: colorDe(g.profe || g.profeId), actividades: [] }
    por.set(g.profeId, p.actividades.includes(g.actividadId) ? p : { ...p, actividades: [...p.actividades, g.actividadId] })
  }
  return [...por.values()]
}

/** El horario del negocio como lo maneja la demo: los días que abre y de qué hora a qué hora (el más amplio). */
export function aperturaDeHorario(h: HorarioSemanal | null | undefined): Apertura {
  const tramos = sesionesDe(h)
  if (!tramos.length) return { dias: [], desde: 7 * 60, hasta: 22 * 60 }
  return {
    dias: [...new Set(tramos.map(t => t.dia))].sort((a, b) => a - b),
    desde: Math.min(...tramos.map(t => t.inicio)),
    hasta: Math.max(...tramos.map(t => t.fin)),
  }
}

/**
 * Los días sin clases: los bloqueos de todo el negocio, como días [desde,
 * hasta). Un bloqueo de una sola clase no es un día sin clases: no va acá (la
 * API igual no deja reservar esa sesión).
 */
export function bloqueosDeApi(bloqueos: Bloqueo[]): BloqueoGym[] {
  return bloqueos.filter(b => !b.recursoId).map(b => {
    const desde = relojArgentina(new Date(b.inicio)).hoy
    const fin = relojArgentina(new Date(b.fin))
    // Termina a las 00:00: ese día ya tiene clases. Termina a mitad de un día: ese día cuenta entero.
    const hasta = fin.ahora === 0 ? fin.hoy : sumarDias(fin.hoy, 1)
    return { id: b.id, desde, hasta, motivo: b.motivo?.trim() || 'Cerrado', origen: 'dueno' as const }
  })
}

/** Lo que el panel lee de la API para armar el negocio. */
export interface CatalogoApi { config: Config; recursos: Recurso[]; bloqueos: Bloqueo[] }

/**
 * El negocio del panel con lo que dice la API: horario, reglas, clases y días
 * sin clases. Lo que la API todavía no guarda (los datos del negocio, planes,
 * mensajes, pagos) sale de `base`, que es el negocio de ejemplo del rubro con
 * el nombre del negocio de verdad; los planes van vacíos.
 */
export function negocioDeApi(base: NegocioGym, c: CatalogoApi): NegocioGym {
  const clases = c.recursos.filter(r => r.tipo === 'CLASE')
  return {
    ...base,
    apertura: aperturaDeHorario(c.config.horario),
    actividades: actividadesDe(clases),
    salas: salasDe(clases),
    profes: profesDe(clases),
    clases: clases.flatMap(clasesDeRecurso),
    planes: [],
    anticipacionDias: c.config.anticipacionMaximaDias,
    cancelaHastaHoras: c.config.cancelacionHastaHoras,
    // La API marca presente o ausente recién cuando la clase empezó.
    checkInMin: 0,
    bloqueos: bloqueosDeApi(c.bloqueos),
    calendariosExternos: [],
  }
}

// ─── Inscripciones y socios ──────────────────────────────────────────────────

type Fila = { id: string; clienteId: string | null; clienteTelefono: string | null; clienteEmail: string | null }

/**
 * Quién es la persona de una reserva o de la espera: su ficha si la tiene; si
 * no, su celular (los últimos 8 dígitos: con o sin 0, 15 o código de país es el
 * mismo) o su email. Así sus reservas caen en el mismo socio.
 */
export function personaDe(x: Fila): string {
  if (x.clienteId) return x.clienteId
  const tel = (x.clienteTelefono ?? '').replace(/\D/g, '')
  if (tel.length >= 6) return `tel:${tel.slice(-8)}`
  if (x.clienteEmail) return `mail:${x.clienteEmail.toLowerCase()}`
  return `sin-datos:${x.id}`
}

/**
 * El estado de una reserva como inscripción, o null si no se muestra: una
 * retenida que venció sin confirmar ya no ocupa lugar (igual que en el
 * servidor, aunque el barrido todavía no la haya marcado).
 */
export function estadoDeReserva(r: Pick<Reserva, 'estado' | 'retenidaHasta'>, ahora: Date): EstadoInscripcion | null {
  switch (r.estado) {
    case 'RETENIDA': return r.retenidaHasta && new Date(r.retenidaHasta).getTime() >= ahora.getTime() ? 'reservada' : null
    case 'PENDIENTE':
    case 'CONFIRMADA': return 'reservada'
    case 'COMPLETADA': return 'asistio'
    case 'AUSENTE': return 'ausente'
    case 'CANCELADA': return 'cancelada'
    case 'VENCIDA': return null
  }
}

/** Para ubicar una reserva en su clase: el recurso, el día de la semana y la hora. */
export function indiceDeClases(clases: ClaseSemanal[]): Map<string, string> {
  return new Map(clases.map(c => [`${recursoDeClase(c.id)}|${c.dia}|${c.inicio}`, c.id]))
}
const llave = (recursoId: string, fecha: ISO, inicio: number) => `${recursoId}|${diaSemana(fecha)}|${inicio}`

export function inscripcionDeReserva(r: Reserva, clases: Map<string, string>, ahora: Date): Inscripcion | null {
  const estado = estadoDeReserva(r, ahora)
  if (!estado) return null
  // Una reserva de un horario que la clase ya no tiene (se movió después) queda con el id de su recurso: si el recurso
  // tiene una sola sesión, ese id es el de la clase y la reserva se sigue viendo en su fecha, con la clase de ahora. La
  // API no deja mover una clase con lugares tomados por delante, así que esto le pasa solo a lo que ya pasó.
  const claseId = clases.get(llave(r.recursoId, r.fecha, r.inicioMinutos)) ?? r.recursoId
  return { id: r.id, claseId, fecha: r.fecha, socioId: personaDe(r), estado, creada: r.creadaEn, planId: null, cantidad: r.cantidad, nombre: r.clienteNombre }
}

const PREFIJO_ESPERA = 'espera:'
/** Una inscripción en espera lleva el id de la fila de la espera con este prefijo: no se confunde con una reserva. */
export const esEspera = (inscripcionId: string) => inscripcionId.startsWith(PREFIJO_ESPERA)
export const idDeEspera = (inscripcionId: string) => inscripcionId.slice(PREFIJO_ESPERA.length)

/** El día (de Argentina) del horario que alguien espera. */
export const fechaDeEspera = (e: Pick<Espera, 'inicio'>): ISO => relojArgentina(new Date(e.inicio)).hoy

export function inscripcionDeEspera(e: Espera, clases: Map<string, string>): Inscripcion {
  const { hoy: fecha, ahora: inicio } = relojArgentina(new Date(e.inicio))
  return { id: `${PREFIJO_ESPERA}${e.id}`, claseId: clases.get(llave(e.recursoId, fecha, inicio)) ?? e.recursoId, fecha, socioId: personaDe(e), estado: 'espera', creada: e.createdAt, planId: null, nombre: e.clienteNombre }
}

/** Las reservas y la espera como inscripciones (las vencidas sin confirmar, afuera). */
export function inscripcionesDeApi(reservas: Reserva[], esperas: Espera[], clases: ClaseSemanal[], ahora: Date): Inscripcion[] {
  const indice = indiceDeClases(clases)
  return [
    ...reservas.map(r => inscripcionDeReserva(r, indice, ahora)).filter((i): i is Inscripcion => i !== null),
    ...esperas.filter(e => e.estado === 'ESPERANDO').map(e => inscripcionDeEspera(e, indice)),
  ]
}

/**
 * Los socios que salen de las reservas y de la lista de espera: uno por
 * persona, con el nombre y el contacto de su fila más nueva y, de alta, el día
 * de la primera. Sin planes: dónde viven planes y alumnos se decide aparte.
 */
export function sociosDeApi(reservas: Reserva[], esperas: Espera[]): Socio[] {
  const filas = [
    ...reservas.map(r => ({ fila: r, nombre: r.clienteNombre, cuando: r.creadaEn })),
    ...esperas.map(e => ({ fila: e, nombre: e.clienteNombre, cuando: e.createdAt })),
  ]
  const por = new Map<string, { nueva: (typeof filas)[number]; primera: string }>()
  for (const f of filas) {
    const k = personaDe(f.fila)
    const ya = por.get(k)
    por.set(k, { nueva: !ya || f.cuando > ya.nueva.cuando ? f : ya.nueva, primera: !ya || f.cuando < ya.primera ? f.cuando : ya.primera })
  }
  return [...por.entries()].map(([id, { nueva, primera }]) => ({
    id,
    nombre: nueva.nombre.trim() || 'Sin nombre',
    telefono: nueva.fila.clienteTelefono ?? '',
    ...(nueva.fila.clienteEmail ? { email: nueva.fila.clienteEmail } : {}),
    planId: null, desde: null, vence: null, clasesRestantes: null, probo: true,
    alta: relojArgentina(new Date(primera)).hoy,
  })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

// ─── Lo que se manda ─────────────────────────────────────────────────────────

/** El horario de un recurso con una sesión cambiada: se saca la vieja (si había) y se suma la nueva. */
export function horarioConSesion(previo: HorarioSemanal | null | undefined, vieja: Pick<Sesion, 'dia' | 'inicio'> | null, nueva: Sesion): HorarioSemanal {
  const h = horarioSinSesion(previo, vieja)
  const k = claveApi(nueva.dia)
  h[k] = [...(h[k] ?? []), [nueva.inicio, nueva.fin] as Tramo].sort((a, b) => a[0] - b[0])
  return h
}

/** El horario de un recurso sin una sesión (la que empieza ese día a esa hora). Los días que quedan vacíos no van. */
export function horarioSinSesion(previo: HorarioSemanal | null | undefined, vieja: Pick<Sesion, 'dia' | 'inicio'> | null): HorarioSemanal {
  const h: HorarioSemanal = {}
  for (const clave of CLAVES) {
    const tramos = (previo?.[clave] ?? []).filter(([a]) => !(vieja && claveApi(vieja.dia) === clave && a === vieja.inicio))
    if (tramos.length) h[clave] = tramos.map(([a, b]) => [a, b] as Tramo)
  }
  return h
}

/**
 * El recurso que guarda una clase de la grilla: uno nuevo, o el que ya la
 * tenía con la clase cambiada. El nombre es el de la actividad. La duración
 * también, salvo que la clase ya existiera y siga con la misma actividad: ahí
 * se conserva la del recurso (tocarle el cupo a una clase de 90 minutos no la
 * deja en los 60 de otra clase de la misma actividad). Del resto de `datos`
 * del recurso, y de lo que haya adentro de `datos.gimnasio` y el panel no
 * maneja, no se pierde nada.
 */
export function recursoParaClase(clase: ClaseSemanal, negocio: Pick<NegocioGym, 'actividades' | 'profes'>, previo?: { recurso: Recurso; clase: ClaseSemanal }): GuardarRecurso {
  const act = negocio.actividades.find(a => a.id === clase.actividadId)
  const mismaActividad = !!previo && previo.clase.actividadId === clase.actividadId
  const duracion = (mismaActividad ? previo.recurso.duracionMinutos : null) ?? act?.duracion ?? 60
  const profe = negocio.profes.find(p => p.id === clase.profeId)
  const gimnasio: DatosGimnasio = { actividadId: clase.actividadId, color: act?.color ?? '', profeId: clase.profeId, profe: profe?.nombre ?? '', sala: clase.sala }
  const crudo = previo?.recurso.datos?.gimnasio
  const deAntes = crudo && typeof crudo === 'object' ? (crudo as Record<string, unknown>) : {}
  return {
    modulo: MODULO, tipo: 'CLASE',
    nombre: act?.nombre ?? previo?.recurso.nombre ?? 'Clase',
    cupo: clase.cupo,
    duracionMinutos: duracion,
    horario: horarioConSesion(previo?.recurso.horario, previo ? previo.clase : null, { dia: clase.dia, inicio: clase.inicio, fin: clase.inicio + duracion }),
    datos: { ...(previo?.recurso.datos ?? {}), gimnasio: { ...deAntes, ...gimnasio } },
  }
}

/** Qué hay que crear, cambiar y quitar para pasar de una grilla a otra. Las clases nuevas no tienen recurso todavía. */
export interface PlanGrilla {
  crear: ClaseSemanal[]
  editar: { antes: ClaseSemanal; despues: ClaseSemanal }[]
  quitar: ClaseSemanal[]
}

const mismaClase = (a: ClaseSemanal, b: ClaseSemanal) =>
  a.actividadId === b.actividadId && a.dia === b.dia && a.inicio === b.inicio && a.profeId === b.profeId && a.sala === b.sala && a.cupo === b.cupo

export function planDeGrilla(antes: ClaseSemanal[], despues: ClaseSemanal[]): PlanGrilla {
  const porId = new Map(antes.map(c => [c.id, c]))
  const quedan = new Set(despues.map(c => c.id))
  return {
    crear: despues.filter(c => !porId.has(c.id)),
    editar: despues.filter(c => porId.has(c.id) && !mismaClase(porId.get(c.id)!, c)).map(c => ({ antes: porId.get(c.id)!, despues: c })),
    quitar: antes.filter(c => !quedan.has(c.id)),
  }
}

/** Qué días sin clases hay que crear y cuáles quitar (el panel no los edita: se quitan y se cargan de nuevo). */
export function planDeBloqueos(antes: BloqueoGym[], despues: BloqueoGym[]): { crear: BloqueoGym[]; quitar: BloqueoGym[] } {
  const habia = new Set(antes.map(b => b.id))
  const quedan = new Set(despues.map(b => b.id))
  return { crear: despues.filter(b => !habia.has(b.id)), quitar: antes.filter(b => !quedan.has(b.id)) }
}

/** Unos días sin clases [desde, hasta) como bloqueo de todo el negocio: de las 00:00 del primero al final del último. */
export const bloqueoParaApi = (b: Pick<BloqueoGym, 'desde' | 'hasta' | 'motivo'>): CrearBloqueo => ({ modulo: MODULO, fechaDesde: b.desde, fechaHasta: sumarDias(b.hasta, -1), motivo: b.motivo })

/** Los datos de contacto de un socio, como los pide la API (sin los vacíos). */
export function clienteDeSocio(s: Pick<Socio, 'nombre' | 'telefono' | 'email'>): Cliente {
  const telefono = s.telefono.trim()
  const email = s.email?.trim() ?? ''
  return { nombre: s.nombre.trim(), ...(telefono ? { telefono } : {}), ...(email ? { email } : {}) }
}

/**
 * Una inscripción hecha desde el panel como reserva confirmada. `clave` es un uuid por intento: si ese mismo pedido se
 * manda dos veces (la red lo repite), la API devuelve la misma reserva. Dos clics en "Anotar" no llegan a ser dos
 * pedidos: el formulario se vacía con el primero.
 */
export function pedidoDeInscripcion(i: Pick<Inscripcion, 'fecha' | 'cantidad'>, clase: ClaseSemanal, socio: Pick<Socio, 'nombre' | 'telefono' | 'email'>, clave: string): CrearDesdePanel {
  return { modulo: MODULO, recursoId: recursoDeClase(clase.id), fecha: i.fecha, inicioMinutos: clase.inicio, cantidad: lugaresDe(i), cliente: clienteDeSocio(socio), estado: 'CONFIRMADA', clave }
}

/** Anotar a alguien en la lista de espera de una clase llena. */
export function esperaDeInscripcion(i: Pick<Inscripcion, 'fecha'>, clase: ClaseSemanal, socio: Pick<Socio, 'nombre' | 'telefono' | 'email'>): AnotarseEnEspera {
  return { modulo: MODULO, recursoId: recursoDeClase(clase.id), fecha: i.fecha, inicioMinutos: clase.inicio, cliente: clienteDeSocio(socio) }
}
