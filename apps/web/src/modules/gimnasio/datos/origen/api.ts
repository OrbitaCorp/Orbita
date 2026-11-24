// El origen de la API de reservas: lo que el panel de un negocio real lee y
// guarda en el backend compartido (módulo GIMNASIO), con la sesión del panel.
// Las traducciones están en mapear.ts; acá, cuándo se lee y qué ruta se llama
// para cada acción.
//
// Cómo lee:
// - Al entrar, una ventana de días alrededor de hoy (cinco semanas para atrás,
//   porque el % de la grilla mira las últimas cuatro; ocho para adelante, la
//   reserva anticipada). Si el panel mira otra fecha, pide solo los días que
//   faltan y los suma (hasta un año para cada lado).
// - Después de cada acción vuelve a leer SOLO lo que esa acción pudo cambiar:
//   el día de esa clase, las clases o los días sin clases. También si la
//   acción falló (un 409: "No queda lugar en ese horario."), porque lo que se
//   veía pudo haber quedado viejo. Releer todo en cada clic no escala: la API
//   corta a los 60 pedidos por minuto por ruta, y tomar asistencia son varios
//   clics seguidos.
// - Con el panel a la vista, cada minuto (y al volver a la pestaña) relee el
//   día que se está mirando: lo que se reservó desde el sitio o desde otra
//   computadora aparece solo.
// - Las lecturas van de a una y en orden: cada una parte de lo que dejó la
//   anterior, así una respuesta que llega tarde no pisa a una más nueva.
//
// Cuando algo falla el panel lo dice: una acción, con el mensaje de la API o
// uno propio en castellano; una lectura, con el aviso de que lo que se ve
// puede estar viejo (VistaGimnasio.desactualizado). Nunca queda en silencio.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { claveDeIntento, panel, ReservasApiError, type ClientePanel } from '@/lib/reservasApi/cliente'
import type { Espera, Recurso, Reserva } from '@/lib/reservasApi/tipos'
import { maxFecha, minFecha, sumarDias, type ISO } from '@/lib/reservas/fechas'
import { avisoDeAfectadas, negocioDe, type Inscripcion, type NegocioGym, type RubroGym, type Socio } from '../index'
import { RELOJ_DEMO, useRelojReal } from '../reloj'
import {
  MODULO, bloqueoParaApi, esEspera, esperaDeInscripcion, fechaDeEspera, horarioSinSesion, idDeEspera, inscripcionesDeApi, negocioDeApi,
  pedidoDeInscripcion, planDeBloqueos, planDeGrilla, recursoDeClase, recursoParaClase, sesionesDe, sociosDeApi, type CatalogoApi,
} from './mapear'
import { LIMITE_DIAS, type AccionesGimnasio, type Capacidades, type OrigenGimnasio, type Resultado, type SeccionGimnasio, type VistaGimnasio } from './index'

/** Los días que se leen para cada lado de hoy. */
export const ATRAS = 35
export const ADELANTE = 56
/** La API lista hasta 93 días por pedido y 500 reservas por página: la ventana de siempre entra en un solo tramo. */
const TRAMO_DIAS = 93
const POR_PAGINA = 500
/** Cada cuánto se relee el día que se está mirando, con el panel a la vista. */
const REFRESCO_MS = 60_000
/** Cuánto se espera una respuesta antes de darla por perdida. */
const ESPERA_MS = 20_000

export interface Ventana { desde: ISO; hasta: ISO }

/** Lo que el panel tiene leído de la API. */
export interface DatosApi extends CatalogoApi { reservas: Reserva[]; esperas: Espera[]; ventana: Ventana }

/** Las secciones que guardan en la API (las demás se ven y avisan que todavía no guardan). */
export const SECCIONES_CONECTADAS: readonly SeccionGimnasio[] = ['clases', 'bloqueos']

/** Lo que no es igual que en la demo (ver Capacidades). */
const PUEDE: Capacidades = { corregirAsistencia: false, catalogoEnLaClase: true, esperaPasaAlSubirCupo: false, liberarEsDefinitivo: true }

export const alrededorDe = (hoy: ISO): Ventana => ({ desde: sumarDias(hoy, -ATRAS), hasta: sumarDias(hoy, ADELANTE) })

/** Si una fecha se puede mirar: hasta LIMITE_DIAS para cada lado de hoy. */
export const seDejaMirar = (hoy: ISO, fecha: ISO): boolean => fecha >= sumarDias(hoy, -LIMITE_DIAS) && fecha <= sumarDias(hoy, LIMITE_DIAS)

/** La ventana agrandada para que entre una fecha y su semana (con margen para la tira de días). */
export function conFecha(v: Ventana, fecha: ISO): Ventana {
  return { desde: minFecha(v.desde, sumarDias(fecha, -7)), hasta: maxFecha(v.hasta, sumarDias(fecha, 7)) }
}
const adentro = (v: Ventana, fecha: ISO) => fecha >= sumarDias(v.desde, 7) && fecha <= sumarDias(v.hasta, -7)
const unir = (a: Ventana, b: Ventana): Ventana => ({ desde: minFecha(a.desde, b.desde), hasta: maxFecha(a.hasta, b.hasta) })
const cubre = (v: Ventana, otra: Ventana) => v.desde <= otra.desde && v.hasta >= otra.hasta

/** Los días de `nueva` que `vieja` no cubre: lo de antes y lo de después. */
export function loQueFalta(vieja: Ventana, nueva: Ventana): Ventana[] {
  const faltan: Ventana[] = []
  if (nueva.desde < vieja.desde) faltan.push({ desde: nueva.desde, hasta: sumarDias(vieja.desde, -1) })
  if (nueva.hasta > vieja.hasta) faltan.push({ desde: sumarDias(vieja.hasta, 1), hasta: nueva.hasta })
  return faltan
}

// ─── Lo que puede fallar ─────────────────────────────────────────────────────

/** Un mensaje del propio panel (no de la red ni de la API), ya escrito para mostrar. */
export class AvisoDelPanel extends Error {}

/**
 * Lo que se le dice a la persona cuando algo falla, siempre en castellano. Lo
 * que rechaza la API ya viene escrito para mostrar ("No queda lugar en ese
 * horario."); lo que no (el tope de pedidos, la sesión vencida, un permiso que
 * falta, el servidor caído) y lo que tira el navegador cuando no hay conexión
 * ("Failed to fetch") se dice acá.
 */
export function mensajeDeFalla(e: unknown): string {
  if (e instanceof AvisoDelPanel) return e.message
  if (e instanceof ReservasApiError) {
    if (e.status === 429) return 'Demasiados pedidos seguidos. Esperá un minuto y probá de nuevo.'
    if (e.status === 401) return 'Tu sesión venció. Volvé a entrar al panel.'
    if (e.status === 403) return 'Tu usuario no tiene permiso para hacer esto. Pedíselo a quien administra el negocio.'
    if (e.status >= 500) return 'El servidor no pudo con el pedido. Probá de nuevo en un momento.'
    return e.message
  }
  return 'No pudimos conectar con el servidor. Revisá tu conexión y probá de nuevo.'
}

/** Una respuesta que no llega a tiempo se da por perdida: el panel no queda trabado esperándola. */
export function conTiempo<T>(p: Promise<T>, ms = ESPERA_MS): Promise<T> {
  return new Promise<T>((ok, mal) => {
    const t = setTimeout(() => mal(new AvisoDelPanel('El servidor tarda en contestar. Revisá tu conexión y probá de nuevo.')), ms)
    p.then(v => { clearTimeout(t); ok(v) }, (e: unknown) => { clearTimeout(t); mal(e) })
  })
}

// ─── Las lecturas ────────────────────────────────────────────────────────────

type Lector = Pick<ClientePanel, 'config' | 'recursos' | 'bloqueos' | 'agenda' | 'espera'>

/** Las reservas de Gimnasio entre dos días: todos los tramos y todas las páginas, cada una una sola vez. */
export async function reservasEntre(cliente: Pick<ClientePanel, 'agenda'>, v: Ventana): Promise<Reserva[]> {
  const porId = new Map<string, Reserva>()
  for (let desde = v.desde; desde <= v.hasta; desde = sumarDias(desde, TRAMO_DIAS)) {
    const hasta = minFecha(sumarDias(desde, TRAMO_DIAS - 1), v.hasta)
    for (let page = 1; ; page++) {
      const p = await cliente.agenda({ modulo: MODULO, desde, hasta, page, limit: POR_PAGINA })
      for (const r of p.data) porId.set(r.id, r)
      if (p.data.length < POR_PAGINA || page * POR_PAGINA >= p.total) break
    }
  }
  return [...porId.values()]
}

/**
 * Todo lo que el panel necesita, de una vez. Sin la config de Gimnasio el
 * negocio todavía no usa el módulo: se avisa así. Los días sin clases se
 * traen desde el principio de la ventana en adelante (todos los que vienen,
 * aunque caigan lejos), y la lista de espera, la de hoy en adelante.
 */
export async function leerApi(cliente: Lector, v: Ventana): Promise<DatosApi> {
  const config = await cliente.config(MODULO)
  if (!config) throw new AvisoDelPanel('Este negocio todavía no tiene Gimnasio configurado.')
  const [recursos, bloqueos, reservas, esperas] = await Promise.all([
    cliente.recursos(MODULO),
    cliente.bloqueos(MODULO, v.desde),
    reservasEntre(cliente, v),
    cliente.espera(MODULO),
  ])
  return { config, recursos, bloqueos, reservas, esperas, ventana: v }
}

/** Qué volver a leer después de una acción: lo que esa acción pudo cambiar, y nada más. */
export interface Refresco {
  /** Las reservas y la lista de espera de ese día. */
  fecha?: ISO
  /** Las clases de la grilla. */
  recursos?: boolean
  /** Los días sin clases. */
  bloqueos?: boolean
}

/** Lee solo eso y lo pone en lugar de lo que había: un par de pedidos, no la ventana entera. */
export async function leerParte(cliente: Lector, antes: DatosApi, que: Refresco): Promise<DatosApi> {
  const { fecha } = que
  const [recursos, bloqueos, delDia] = await Promise.all([
    que.recursos ? cliente.recursos(MODULO) : antes.recursos,
    que.bloqueos ? cliente.bloqueos(MODULO, antes.ventana.desde) : antes.bloqueos,
    fecha ? Promise.all([reservasEntre(cliente, { desde: fecha, hasta: fecha }), cliente.espera(MODULO, undefined, fecha)]) : null,
  ])
  if (!fecha || !delDia) return { ...antes, recursos, bloqueos }
  return {
    ...antes, recursos, bloqueos,
    reservas: [...antes.reservas.filter(r => r.fecha !== fecha), ...delDia[0]],
    esperas: [...antes.esperas.filter(e => fechaDeEspera(e) !== fecha), ...delDia[1]],
  }
}

/** Agranda lo leído hasta cubrir `nueva`: pide solo los días que faltan y los suma. */
export async function leerMasDias(cliente: Lector, antes: DatosApi, nueva: Ventana): Promise<DatosApi> {
  const faltan = loQueFalta(antes.ventana, nueva)
  if (faltan.length === 0) return antes
  const [tramos, bloqueos] = await Promise.all([
    Promise.all(faltan.map(f => reservasEntre(cliente, f))),
    // Los días sin clases se piden "desde": si la ventana crece para atrás, hay que traer los de antes también.
    nueva.desde < antes.ventana.desde ? cliente.bloqueos(MODULO, nueva.desde) : antes.bloqueos,
  ])
  const porId = new Map(antes.reservas.map(r => [r.id, r] as const))
  for (const r of tramos.flat()) porId.set(r.id, r)
  return { ...antes, bloqueos, reservas: [...porId.values()], ventana: unir(antes.ventana, nueva) }
}

// ─── Las acciones ────────────────────────────────────────────────────────────

type Escritor = Pick<ClientePanel, 'crearRecurso' | 'editarRecurso' | 'borrarRecurso' | 'crearBloqueo' | 'borrarBloqueo' | 'crear' | 'completar' | 'ausente' | 'cancelar' | 'anotarEnEspera' | 'darLugar' | 'quitarDeEspera'>

export interface DepsAcciones {
  cliente: Escritor
  /** Los recursos tal como están en la API (para editar el que guarda cada clase). */
  recursos: Recurso[]
  negocio: NegocioGym
  socios: Socio[]
  /** Para saber de qué día es la inscripción que se toca, y releer ese día. */
  inscripciones: Inscripcion[]
  /** Después de cada acción, salga bien o mal: volver a leer lo que esa acción pudo cambiar ('todo' si no se sabe qué). */
  refrescar: (que: Refresco | 'todo') => void
  /** Un uuid por intento de reserva (los tests lo fijan). */
  clave?: () => string
}

const hecho: Resultado = {}
const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? nombre
/** Lo que puede acompañar a `clases` en un guardado de la grilla: lo que se escribió al cargar una clase. */
const CON_LA_GRILLA = ['actividades', 'profes', 'salas']

/**
 * Las acciones del panel traducidas a rutas de /reservas. Van de a una y en
 * orden: si una falla, las que siguen no se mandan. Lo que falla sale como un
 * Error con el mensaje listo para mostrar (mensajeDeFalla).
 */
export function accionesApi(d: DepsAcciones): AccionesGimnasio {
  const clave = d.clave ?? claveDeIntento
  /** Corre la acción y, salga bien o mal, manda a releer lo suyo. */
  const con = (que: Refresco | 'todo', f: () => Promise<Resultado>): Promise<Resultado> =>
    conTiempo(Promise.resolve().then(f))
      .catch((e: unknown) => { throw new Error(mensajeDeFalla(e)) })
      .finally(() => d.refrescar(que))
  const recursos = new Map(d.recursos.map(r => [r.id, r]))
  const recursoDe = (claseId: string) => {
    const r = recursos.get(recursoDeClase(claseId))
    if (!r) throw new AvisoDelPanel('Esa clase ya no está en la grilla. Actualizá el panel.')
    return r
  }
  const claseDe = (id: string) => {
    const c = d.negocio.clases.find(x => x.id === id)
    if (!c) throw new AvisoDelPanel('Esa clase ya no está en la grilla. Actualizá el panel.')
    return c
  }
  /** El día de una inscripción, para releerlo; si no se la encuentra, se relee todo. */
  const delDiaDe = (inscripcionId: string): Refresco | 'todo' => {
    const fecha = d.inscripciones.find(i => i.id === inscripcionId)?.fecha
    return fecha ? { fecha } : 'todo'
  }

  async function guardarGrilla(clases: NegocioGym['clases'], catalogo: Pick<NegocioGym, 'actividades' | 'profes'>) {
    const plan = planDeGrilla(d.negocio.clases, clases)
    for (const c of plan.crear) await d.cliente.crearRecurso(recursoParaClase(c, catalogo))
    for (const { antes, despues } of plan.editar) {
      const r = recursoDe(antes.id)
      // El recurso actualizado reemplaza al leído: dos clases del mismo recurso en un guardado no se pisan.
      recursos.set(r.id, await d.cliente.editarRecurso(r.id, recursoParaClase(despues, catalogo, { recurso: r, clase: antes })))
    }
    for (const c of plan.quitar) {
      const r = recursoDe(c.id)
      if (sesionesDe(r.horario).length <= 1) {
        await d.cliente.borrarRecurso(r.id)
        recursos.delete(r.id)
      } else {
        recursos.set(r.id, await d.cliente.editarRecurso(r.id, { modulo: MODULO, tipo: 'CLASE', nombre: r.nombre, horario: horarioSinSesion(r.horario, c) }))
      }
    }
  }

  async function guardarBloqueos(bloqueos: NegocioGym['bloqueos']): Promise<Resultado> {
    const plan = planDeBloqueos(d.negocio.bloqueos, bloqueos)
    let afectadas = 0
    for (const b of plan.crear) afectadas += (await d.cliente.crearBloqueo(bloqueoParaApi(b))).afectadas
    for (const b of plan.quitar) await d.cliente.borrarBloqueo(b.id)
    const detalle = avisoDeAfectadas(afectadas)
    return detalle ? { detalle } : hecho
  }

  return {
    configurar: cambio => con({ recursos: !!cambio.clases, bloqueos: !!cambio.bloqueos }, async () => {
      // Solo la grilla y los días sin clases guardan en la API: el panel no manda lo demás (ver guarda()). Las actividades,
      // los profes y las salas valen solo junto con la grilla: son los que se escribieron al cargar una clase, y viajan
      // adentro de su recurso (la API todavía no tiene dónde guardarlos sueltos).
      const claves = Object.keys(cambio)
      const otras = claves.filter(k => k !== 'clases' && k !== 'bloqueos' && !(cambio.clases && CON_LA_GRILLA.includes(k)))
      if (otras.length) throw new AvisoDelPanel('Esta sección todavía no guarda en la API.')
      if (cambio.clases) await guardarGrilla(cambio.clases, { actividades: cambio.actividades ?? d.negocio.actividades, profes: cambio.profes ?? d.negocio.profes })
      return cambio.bloqueos ? guardarBloqueos(cambio.bloqueos) : hecho
    }),

    inscribir: (i, nuevo) => con({ fecha: i.fecha }, async () => {
      const c = claseDe(i.claseId)
      const s = nuevo ?? d.socios.find(x => x.id === i.socioId)
      if (!s) throw new AvisoDelPanel('No encontramos a esa persona. Actualizá el panel.')
      if (i.estado === 'espera') {
        const e = await d.cliente.anotarEnEspera(esperaDeInscripcion(i, c, s))
        return e.posicion ? { detalle: `Está en el lugar ${e.posicion} de la lista.` } : hecho
      }
      await d.cliente.crear(pedidoDeInscripcion(i, c, s, clave()))
      return hecho
    }),

    cambiarInscripcion: (id, cambio) => con(delDiaDe(id), async () => {
      if (esEspera(id)) {
        if (cambio.estado !== 'reservada') throw new AvisoDelPanel('A quien espera solo se le puede dar el lugar o sacar de la lista.')
        await d.cliente.darLugar(idDeEspera(id))
        return hecho
      }
      if (cambio.estado === 'asistio') await d.cliente.completar(id)
      else if (cambio.estado === 'ausente') await d.cliente.ausente(id)
      else throw new AvisoDelPanel('Ese cambio todavía no se guarda en la API.')
      return hecho
    }),

    cancelar: id => con(delDiaDe(id), async () => {
      if (esEspera(id)) {
        await d.cliente.quitarDeEspera(idDeEspera(id))
        return hecho
      }
      const r = await d.cliente.cancelar(id, { motivo: 'Lugar liberado desde el panel.' })
      return r.promovida ? { detalle: `${primerNombre(r.promovida.clienteNombre)} pasó de la lista de espera y ya tiene su lugar.` } : hecho
    }),

    // Alumnos y planes no viven en la API todavía (decisión del 16/11): el panel no llama a estas.
    agregarSocio: () => con({}, async () => { throw new AvisoDelPanel('Los alumnos todavía no se guardan en la API.') }),
    cambiarSocio: () => con({}, async () => { throw new AvisoDelPanel('Los alumnos todavía no se guardan en la API.') }),
  }
}

/** Las mismas acciones, avisando antes de salir (el panel queda ocupado hasta la lectura que sigue). */
export function ocupando(a: AccionesGimnasio, marcar: () => void): AccionesGimnasio {
  return Object.fromEntries(Object.entries(a).map(([nombre, f]) => [nombre, (...args: unknown[]) => { marcar(); return (f as (...x: unknown[]) => Promise<Resultado>)(...args) }])) as unknown as AccionesGimnasio
}

// ─── La cola de lecturas ─────────────────────────────────────────────────────

/** Una lectura en cola: recibe lo último leído y devuelve lo nuevo, o null si no hay nada que cambiar. */
export type Lectura = (antes: DatosApi | null) => Promise<DatosApi | null>

/** Cómo terminó una lectura: lo que quedó leído, o el mensaje de por qué falló. */
export type Leido = { datos: DatosApi } | { falla: string }

/**
 * Las lecturas del panel, de a una y en orden: cada una arranca cuando terminó
 * la anterior y parte de lo que esa dejó (así una respuesta que tarda no pisa
 * a una más nueva), y una que falla no corta la cola. Lleva también el día
 * que se está mirando, que es el que se relee cada minuto.
 *
 * Es un objeto por panel montado y vive fuera del render: el hook lo crea una
 * vez, lo abre al montarse y lo cierra al desmontarse, y se entera de cada
 * lectura por `avisar`. Nada de lo que guarda se lee mientras React dibuja.
 */
export class ColaDeLecturas {
  private turno: Promise<void> = Promise.resolve()
  private leido: DatosApi | null = null
  private abierta = false
  private refrescando = false
  private dia: ISO | null = null

  constructor(private readonly avisar: (r: Leido) => void) {}

  /** El panel está montado: las lecturas cuentan. */
  abrir(): void { this.abierta = true }
  /** El panel se desmontó: lo que llegue después no se avisa ni se guarda. */
  cerrar(): void { this.abierta = false }

  /** El día que el panel tiene a la vista. */
  mirar(fecha: ISO): void { this.dia = fecha }
  get mirada(): ISO | null { return this.dia }

  /** Suma una lectura al final de la cola. La promesa se cumple cuando esa lectura terminó, haya salido bien o mal. */
  encolar(leer: Lectura): Promise<void> {
    const turno = this.turno.then(async () => {
      if (!this.abierta) return
      try {
        const datos = await conTiempo(leer(this.leido))
        if (!this.abierta || !datos) return
        this.leido = datos
        this.avisar({ datos })
      } catch (e) {
        if (this.abierta) this.avisar({ falla: mensajeDeFalla(e) })
      }
    })
    this.turno = turno
    return turno
  }

  /** El refresco de cada minuto: si el anterior todavía no terminó, este no se suma (no se apilan). */
  refrescar(leer: Lectura): void {
    if (this.refrescando) return
    this.refrescando = true
    void this.encolar(leer).finally(() => { this.refrescando = false })
  }
}

// ─── El hook ─────────────────────────────────────────────────────────────────

/** Cómo se llama el rol de quien mira, en el armazón del panel. */
const ROLES: Record<string, string> = { owner: 'Dueño', admin: 'Administración', empleado: 'Equipo' }

interface Estado {
  datos: DatosApi | null
  /** Por qué no se pudo abrir el panel (solo sin datos). */
  error: string | null
  /** La última lectura falló: lo que se ve puede no ser lo que hay guardado. */
  viejo: boolean
}

function useVistaApi(rubro: RubroGym): VistaGimnasio {
  const { user } = useAuth()
  const foto = useRelojReal()
  const hoy = foto?.reloj.hoy ?? null
  const [estado, setEstado] = useState<Estado>({ datos: null, error: null, viejo: false })
  // Las acciones en vuelo: cada una cuenta desde que sale hasta que termina la lectura que la sigue.
  const [enVuelo, setEnVuelo] = useState(0)

  // La cola de lecturas de este panel (ver ColaDeLecturas): una sola, creada al montar. Lo que termina de leerse
  // pasa al estado; si una lectura falla con datos ya en pantalla, se marcan como viejos en vez de borrarlos.
  const [cola] = useState(() => new ColaDeLecturas(r => setEstado(s => {
    if ('datos' in r) return { datos: r.datos, error: null, viejo: false }
    return s.datos ? { ...s, viejo: true } : { datos: null, error: r.falla, viejo: false }
  })))
  useEffect(() => { cola.abrir(); return () => cola.cerrar() }, [cola])

  // Al entrar: la ventana alrededor de hoy. A la medianoche (cuando cambia "hoy") la ventana se corre
  // un día y se pide solo lo que falta. Si ya está todo leído, nada.
  useEffect(() => {
    if (!hoy) return
    void cola.encolar(async antes => {
      const deHoy = alrededorDe(hoy)
      if (!antes) return leerApi(panel, deHoy)
      return cubre(antes.ventana, deHoy) ? null : leerMasDias(panel, antes, unir(antes.ventana, deHoy))
    })
  }, [hoy, cola])

  // Con el panel a la vista, el día que se mira se relee cada minuto y al volver a la pestaña: lo que
  // se reservó desde el sitio o desde otra computadora aparece sin que nadie toque nada.
  useEffect(() => {
    if (!hoy) return
    const releerElDia = () => {
      if (document.visibilityState !== 'visible') return
      const fecha = cola.mirada ?? hoy
      cola.refrescar(async antes => (antes ? leerParte(panel, antes, { fecha }) : null))
    }
    const cada = setInterval(releerElDia, REFRESCO_MS)
    document.addEventListener('visibilitychange', releerElDia)
    return () => { clearInterval(cada); document.removeEventListener('visibilitychange', releerElDia) }
  }, [hoy, cola])

  const leerTodo = useCallback(() => {
    if (!hoy) return
    // Sin datos, el error se limpia para que vuelva la silueta de carga mientras se reintenta.
    setEstado(s => (s.datos ? s : { ...s, error: null }))
    void cola.encolar(antes => leerApi(panel, antes?.ventana ?? alrededorDe(hoy)))
  }, [hoy, cola])

  const verFecha = useCallback((fecha: ISO) => {
    if (!hoy || !seDejaMirar(hoy, fecha)) return
    cola.mirar(fecha)
    void cola.encolar(async antes => {
      if (!antes) return leerApi(panel, conFecha(alrededorDe(hoy), fecha))
      return adentro(antes.ventana, fecha) ? null : leerMasDias(panel, antes, conFecha(antes.ventana, fecha))
    })
  }, [hoy, cola])

  const base = useMemo(() => {
    const n = negocioDe(rubro)
    return user?.type === 'member' ? { ...n, nombre: user.business.name } : n
  }, [rubro, user])
  const datos = estado.datos
  const negocio = useMemo(() => (datos ? negocioDeApi(base, datos) : base), [base, datos])
  const ms = foto?.ms ?? 0
  const inscripciones = useMemo<Inscripcion[]>(() => (datos ? inscripcionesDeApi(datos.reservas, datos.esperas, negocio.clases, new Date(ms)) : []), [datos, negocio.clases, ms])
  const socios = useMemo(() => (datos ? sociosDeApi(datos.reservas, datos.esperas) : []), [datos])
  const acciones = useMemo(() => {
    // Lo que sigue a cada acción: releer lo suyo y, recién ahí, soltar el panel. No hace falta mirar si
    // el panel sigue montado: avisarle a un componente que ya no está no hace nada.
    const refrescar = (que: Refresco | 'todo') => {
      void cola.encolar(async antes => {
        if (que === 'todo' || !antes) return hoy ? leerApi(panel, antes?.ventana ?? alrededorDe(hoy)) : null
        return leerParte(panel, antes, que)
      }).finally(() => setEnVuelo(n => Math.max(0, n - 1)))
    }
    return ocupando(accionesApi({ cliente: panel, recursos: datos?.recursos ?? [], negocio, socios, inscripciones, refrescar }), () => setEnVuelo(n => n + 1))
  }, [datos, negocio, socios, inscripciones, hoy, cola])

  return {
    tipo: 'api', negocio, socios, inscripciones,
    // Sin hora todavía (el render de la hidratación) el panel no está listo y no la usa.
    reloj: foto?.reloj ?? RELOJ_DEMO,
    usuario: user?.type === 'member' ? { nombre: user.member.name, rol: ROLES[user.role] ?? user.role } : { nombre: '', rol: '' },
    listo: !!datos && !!foto,
    ocupado: enVuelo > 0,
    error: datos ? null : estado.error,
    reintentar: leerTodo,
    desactualizado: !!datos && estado.viejo,
    actualizar: leerTodo,
    guarda: seccion => SECCIONES_CONECTADAS.includes(seccion),
    puede: PUEDE,
    verFecha,
    leidoHasta: datos?.ventana.hasta ?? null,
    acciones,
  }
}

export const origenApi: OrigenGimnasio = { tipo: 'api', useVista: useVistaApi }
