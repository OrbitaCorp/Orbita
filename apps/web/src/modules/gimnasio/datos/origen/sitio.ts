// Lo que el sitio público de un gimnasio real le pide a la API, sin sesión, y
// lo que hace con eso: armar el negocio y los días que se pueden reservar, y
// llevar una reserva de punta a punta (tomar el lugar, confirmarlo, anotarse
// en la lista de espera). Sin React: el sitio (storefront/SitioReal.tsx) lo
// usa y los tests lo prueban con una API de mentira.
//
// De dónde sale cada cosa:
// - el nombre, el logo, la frase y el WhatsApp, de la config pública de la
//   tienda (la misma del resto de Órbita); el rubro, de sus subrubros;
// - las reglas (hasta cuántos días adelante, hasta cuándo se cancela, cuánto
//   dura un lugar retenido, si hay lista de espera), de la config pública de
//   reservas;
// - qué clases hay (actividad, profe, sala, cupo), de los recursos del motor;
// - cuáles se pueden reservar cada día y con cuántos lugares, de la grilla de
//   Gimnasio: un solo pedido para todas las clases (el sitio no tiene sesión y
//   los pedidos se cuentan por IP). La grilla ya viene con las reglas del
//   sitio aplicadas: no trae la clase que empezó, la que empieza antes de la
//   anticipación mínima ni la de un día cerrado. Lo que no está ahí no se
//   ofrece, sin volver a hacer esas cuentas acá.
//
// Cómo se paga no se elige en el sitio: el lugar nace sin definir y el negocio
// lo dice desde su panel (con el plan de la persona, aparte o como clase de
// prueba). Sin sesión no se descuenta un pack con solo escribir un celular.
import { getStorefrontConfig } from '@/lib/storefront/api'
import { ReservasApiError, sitio as sitioDeReservas } from '@/lib/reservasApi/cliente'
import type { AnotadaEnEspera, AnotarseEnEspera, ConfigPublica, Confirmar, Recurso, ReservaConToken, Retener } from '@/lib/reservasApi/tipos'
import { diaSemana, sumarDias, type ISO } from '@/lib/reservas/fechas'
import { actividadDe, negocioDe, profeDe, rubroPorKey, RUBROS_GYM, type NegocioGym, type RubroGym } from '../index'
import { gimnasioSitio, type GrillaApi, type PlanApi } from './gimnasioApi'
import { MODULO, indiceDeClases, negocioDeApi, recursoDeClase, sesionesDe, type Sesion } from './mapear'

/** La API arma hasta 35 días de grilla por pedido: es lo más lejos que muestra el sitio, aunque el negocio deje reservar más adelante. */
export const DIAS_DE_GRILLA = 34

// ─── Lo que se lee ───────────────────────────────────────────────────────────

/** Lo que el sitio usa de la config pública de la tienda. */
export interface TiendaDelSitio {
  business: { name: string; subdomain: string; subrubros?: string[] | null }
  appearance: { storeName: string | null; tagline: string | null; logoUrl: string | null } | null
  contact: { whatsapp: string | null } | null
}

/** La API del sitio de un negocio: las lecturas y lo que hace falta para reservar. Todo sin sesión. */
export interface ApiDelSitio {
  tienda(): Promise<TiendaDelSitio>
  config(): Promise<ConfigPublica>
  recursos(): Promise<Recurso[]>
  planes(): Promise<Omit<PlanApi, 'activo'>[]>
  grilla(desde: ISO, hasta: ISO): Promise<GrillaApi>
  retener(datos: Retener): Promise<ReservaConToken>
  confirmar(token: string, datos: Confirmar): Promise<ReservaConToken>
  cancelar(token: string): Promise<unknown>
  anotarseEnEspera(datos: AnotarseEnEspera): Promise<AnotadaEnEspera>
}

export function apiDelSitio(slug: string): ApiDelSitio {
  const reservas = sitioDeReservas(slug)
  const gimnasio = gimnasioSitio(slug)
  return {
    tienda: () => getStorefrontConfig(slug),
    config: () => reservas.config(MODULO),
    recursos: () => reservas.recursos(MODULO),
    planes: gimnasio.planes,
    grilla: gimnasio.grilla,
    retener: reservas.retener,
    confirmar: reservas.confirmar,
    cancelar: token => reservas.cancelar(token),
    anotarseEnEspera: reservas.anotarseEnEspera,
  }
}

/** Una clase de un día, como la muestra el sitio y con lo que hace falta para reservarla. */
export interface ClaseDelSitio {
  /** El id de la clase en la grilla semanal: con la fecha, único. Es lo que viaja en ?clase=. */
  id: string
  recursoId: string
  fecha: ISO
  /** Minutos desde las 00:00 de Argentina. */
  inicio: number
  fin: number
  actividad: string
  color: string
  /** '' = todavía sin profe. */
  profe: string
  sala: string
  libres: number
  cupo: number
}

export interface DiaDelSitio {
  fecha: ISO
  /** El negocio cerró el día entero: `motivo` es lo que cargó (un feriado, vacaciones). */
  cerrado: boolean
  motivo: string | null
  /** Las clases que se pueden reservar ese día, por hora. */
  clases: ClaseDelSitio[]
}

export interface ReglasDelSitio {
  /** Hasta cuántos días adelante muestra el sitio (la anticipación del negocio, con el tope de la grilla). */
  dias: number
  cancelaHastaHoras: number
  /** Cuántos minutos queda guardado un lugar mientras la persona carga sus datos. */
  retencionMinutos: number
  listaDeEspera: boolean
  /** El negocio confirma a mano: la reserva nace pendiente. */
  confirmaElNegocio: boolean
}

export interface CargaSitio {
  rubro: RubroGym
  negocio: NegocioGym
  /** De hoy al último día que se puede reservar. */
  dias: DiaDelSitio[]
  /** Cuándo abre el negocio: cada tramo de su horario, de lunes (0) a domingo. */
  horarios: Sesion[]
  reglas: ReglasDelSitio
}

/** El rubro del negocio: el primero de sus subrubros que sea uno de Gimnasio; si no dice, el gimnasio de siempre. */
export function rubroDelNegocio(subrubros: readonly string[] | null | undefined): RubroGym {
  const key = (subrubros ?? []).find(s => RUBROS_GYM.some(r => r.key === s))
  return rubroPorKey(key ?? RUBROS_GYM[0].key)
}

/**
 * El negocio como lo ve un visitante, armado solo con lo público. Lo que el
 * sitio no tiene de dónde sacar (la dirección, las fotos) queda vacío, y las
 * pantallas no muestran esa parte: nunca los datos del negocio de ejemplo.
 */
export function negocioDelSitio(p: { slug: string; tienda: TiendaDelSitio; config: ConfigPublica; recursos: Recurso[]; planes: Omit<PlanApi, 'activo'>[] }): { rubro: RubroGym; negocio: NegocioGym } {
  const rubro = rubroDelNegocio(p.tienda.business.subrubros)
  const base: NegocioGym = {
    ...negocioDe(rubro),
    nombre: p.tienda.appearance?.storeName?.trim() || p.tienda.business.name,
    slug: p.slug,
    descripcion: p.tienda.appearance?.tagline?.trim() ?? '',
    telefono: p.tienda.contact?.whatsapp?.trim() ?? '',
    logo: p.tienda.appearance?.logoUrl ?? null,
    direccion: '', ciudad: '', fotoPortada: '', galeria: [],
    dueno: { nombre: '', rol: '' },
  }
  // El sitio trae solo lo que se ofrece: los recursos activos y los planes que el negocio muestra.
  const negocio = negocioDeApi(base, { config: p.config, recursos: p.recursos.filter(r => r.activo), bloqueos: [], planes: p.planes.map(x => ({ ...x, activo: true })) })
  return { rubro, negocio }
}

/**
 * Los días del sitio: cada sesión de la grilla con los datos de su clase. Una
 * sesión de una clase que el sitio no conoce (se creó entre un pedido y el
 * otro) no se muestra: aparece en la próxima carga.
 */
export function diasDelSitio(negocio: NegocioGym, grilla: GrillaApi): DiaDelSitio[] {
  const indice = indiceDeClases(negocio.clases)
  const porId = new Map(negocio.clases.map(c => [c.id, c]))
  return grilla.dias.map(d => ({
    fecha: d.fecha, cerrado: d.cerrado, motivo: d.motivo,
    clases: d.sesiones.flatMap(s => {
      const id = indice.get(`${s.recursoId}|${diaSemana(d.fecha)}|${s.inicioMinutos}`)
      const clase = id ? porId.get(id) : undefined
      if (!clase) return []
      const act = actividadDe(negocio, clase.actividadId)
      return [{
        id: clase.id, recursoId: recursoDeClase(clase.id), fecha: d.fecha, inicio: s.inicioMinutos, fin: s.finMinutos,
        actividad: act?.nombre ?? 'Clase', color: act?.color ?? '', profe: profeDe(negocio, clase.profeId)?.nombre ?? '', sala: clase.sala,
        libres: s.libres, cupo: s.cupo,
      }]
    }).sort((a, b) => a.inicio - b.inicio || a.actividad.localeCompare(b.actividad, 'es')),
  }))
}

const ventana = (hoy: ISO, config: Pick<ConfigPublica, 'anticipacionMaximaDias'>) => Math.max(0, Math.min(config.anticipacionMaximaDias, DIAS_DE_GRILLA))

/**
 * Todo lo que el sitio necesita para dibujarse y dejar reservar. Falla con el
 * mensaje de la API (negocio pausado, reservas online pausadas). Los planes
 * son un dato de más: si no llegan, el sitio se muestra sin esa sección.
 */
export async function cargarSitio(api: ApiDelSitio, slug: string, hoy: ISO): Promise<CargaSitio> {
  const [tienda, config, recursos, planes] = await Promise.all([api.tienda(), api.config(), api.recursos(), api.planes().catch(() => [])])
  const dias = ventana(hoy, config)
  const grilla = await api.grilla(hoy, sumarDias(hoy, dias))
  const { rubro, negocio } = negocioDelSitio({ slug, tienda, config, recursos, planes })
  return {
    rubro, negocio, dias: diasDelSitio(negocio, grilla), horarios: sesionesDe(config.horario),
    reglas: {
      dias, cancelaHastaHoras: config.cancelacionHastaHoras, retencionMinutos: config.retencionMinutos,
      listaDeEspera: config.listaDeEspera, confirmaElNegocio: config.confirmacion === 'MANUAL',
    },
  }
}

/** Vuelve a pedir solo la grilla (los lugares cambian; el negocio y sus clases, casi nunca): después de reservar o de un "no queda lugar". */
export async function releerDias(api: ApiDelSitio, carga: CargaSitio, hoy: ISO): Promise<CargaSitio> {
  const grilla = await api.grilla(hoy, sumarDias(hoy, carga.reglas.dias))
  return { ...carga, dias: diasDelSitio(carga.negocio, grilla) }
}

// ─── Los datos de quien reserva ──────────────────────────────────────────────

export interface DatosDeContacto { nombre: string; telefono: string; email: string; notas: string }

/** Lo que falta o está mal, por campo, con las mismas reglas que la API (así no se llega a pedirle algo que va a rechazar). */
export function erroresDeContacto(d: DatosDeContacto): Partial<Record<'nombre' | 'telefono' | 'email', string>> {
  const e: Partial<Record<'nombre' | 'telefono' | 'email', string>> = {}
  if (d.nombre.trim().length < 3) e.nombre = 'Escribí tu nombre y apellido.'
  const tel = d.telefono.trim()
  if (!/^[\d\s()+-]{6,30}$/.test(tel)) e.telefono = tel ? 'Solo números (podés usar espacios, + y guiones).' : 'Escribí un celular con código de área.'
  else if (tel.replace(/\D/g, '').length < 8) e.telefono = 'Escribí un celular con código de área.'
  if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) e.email = 'Revisá el email.'
  return e
}

const clienteDe = (d: DatosDeContacto) => ({ nombre: d.nombre.trim(), telefono: d.telefono.trim(), ...(d.email.trim() ? { email: d.email.trim() } : {}) })

// ─── Reservar ────────────────────────────────────────────────────────────────

const SIN_CONEXION = 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo: tu lugar no se duplica.'
const mensajeDe = (e: unknown) => (e instanceof ReservasApiError ? e.message : SIN_CONEXION)

/**
 * La clave del intento: la misma mientras se pida lo mismo, así un doble toque
 * o un reintento después de un corte no toman dos lugares (el servidor
 * devuelve el que ya tomó). Con otra clase, o cuando el intento se cierra
 * (quedó confirmado o se venció), la próxima es una clave nueva.
 */
export class Intento {
  private actual: { firma: string; clave: string } | null = null
  constructor(private readonly nueva: () => string) {}
  para(firma: string): string {
    if (this.actual?.firma !== firma) this.actual = { firma, clave: this.nueva() }
    return this.actual.clave
  }
  cerrar(): void { this.actual = null }
}

/** La firma de un pedido: la misma clase el mismo día. */
export const firmaDe = (c: Pick<ClaseDelSitio, 'recursoId' | 'fecha' | 'inicio'>) => `${c.recursoId}|${c.fecha}|${c.inicio}`

/** Un lugar tomado, a la espera de los datos de la persona. */
export interface LugarTomado {
  token: string
  /** El instante (ISO) hasta el que queda guardado. */
  hasta: string
  firma: string
}

export type ResultadoDeTomar =
  | { ok: true; lugar: LugarTomado }
  /** `lleno`: la clase se completó mientras tanto (hay que volver a mirar los lugares). */
  | { ok: false; mensaje: string; lleno: boolean }

const sigueTomado = (r: Pick<ReservaConToken, 'estado' | 'retenidaHasta'>, ahora: number) => r.estado === 'RETENIDA' && !!r.retenidaHasta && new Date(r.retenidaHasta).getTime() > ahora

/**
 * Paso 1: toma el lugar mientras la persona carga sus datos. Repetirlo con el
 * mismo intento devuelve el mismo lugar. Si ese lugar ya no sirve (se venció
 * el tiempo y el servidor devuelve el de antes), cierra el intento y prueba
 * una vez con uno nuevo. No tira: dice qué pasó, con el mensaje de la API.
 * `reloj` da el instante de ahora (ms): el del sistema, salvo en los tests.
 */
export async function tomarLugar(api: ApiDelSitio, intento: Intento, clase: ClaseDelSitio, reloj: () => number = Date.now): Promise<ResultadoDeTomar> {
  const firma = firmaDe(clase)
  const pedir = () => api.retener({ modulo: MODULO, recursoId: clase.recursoId, fecha: clase.fecha, inicioMinutos: clase.inicio, cantidad: 1, clave: intento.para(firma) })
  try {
    let r = await pedir()
    if (!sigueTomado(r, reloj())) {
      intento.cerrar()
      r = await pedir()
    }
    if (!sigueTomado(r, reloj()) || !r.retenidaHasta) return { ok: false, mensaje: 'No pudimos guardarte el lugar. Probá de nuevo.', lleno: false }
    return { ok: true, lugar: { token: r.token, hasta: r.retenidaHasta, firma } }
  } catch (e) {
    return { ok: false, mensaje: mensajeDe(e), lleno: e instanceof ReservasApiError && e.esConflicto }
  }
}

/** Suelta un lugar tomado que ya no se va a usar (se eligió otra clase). Si no se puede, se vence solo: no avisa nada. */
export async function soltarLugar(api: ApiDelSitio, lugar: LugarTomado): Promise<void> {
  try { await api.cancelar(lugar.token) } catch { /* se vence solo */ }
}

/** Lo que el sitio muestra de una reserva recién hecha. */
export interface ReservaHecha {
  codigo: string
  /** El negocio confirma a mano: todavía no es firme. */
  pendiente: boolean
  nombre: string
  email: string | null
}

export type ResultadoDeConfirmar =
  | { ok: true; hecha: ReservaHecha }
  /** `vencido`: el lugar ya no está tomado (pasó el tiempo): hay que elegir la clase de nuevo. */
  | { ok: false; mensaje: string; vencido: boolean }

/** Paso 2: el lugar tomado queda firme con los datos de la persona. Confirmar dos veces devuelve la misma reserva. */
export async function confirmarLugar(api: ApiDelSitio, lugar: LugarTomado, datos: DatosDeContacto): Promise<ResultadoDeConfirmar> {
  try {
    const notas = datos.notas.trim()
    const r = await api.confirmar(lugar.token, { cliente: clienteDe(datos), ...(notas ? { notas } : {}) })
    if (r.estado !== 'CONFIRMADA' && r.estado !== 'PENDIENTE') return { ok: false, mensaje: 'La reserva no quedó tomada. Elegí la clase de nuevo.', vencido: true }
    return { ok: true, hecha: { codigo: r.codigo, pendiente: r.estado === 'PENDIENTE', nombre: r.clienteNombre, email: r.clienteEmail } }
  } catch (e) {
    return { ok: false, mensaje: mensajeDe(e), vencido: e instanceof ReservasApiError && e.esConflicto }
  }
}

export type ResultadoDeEspera =
  | { ok: true; posicion: number | null; yaEstaba: boolean }
  /** `hayLugar`: se liberó un lugar mientras tanto: se reserva directo. */
  | { ok: false; mensaje: string; hayLugar: boolean }

/** Con la clase llena: anota a la persona en la lista de espera. Repetirlo no la anota dos veces. */
export async function anotarEnEspera(api: ApiDelSitio, clase: ClaseDelSitio, datos: DatosDeContacto): Promise<ResultadoDeEspera> {
  try {
    const r = await api.anotarseEnEspera({ modulo: MODULO, recursoId: clase.recursoId, fecha: clase.fecha, inicioMinutos: clase.inicio, cliente: clienteDe(datos) })
    return { ok: true, posicion: r.posicion, yaEstaba: r.yaEstaba }
  } catch (e) {
    const mensaje = mensajeDe(e)
    return { ok: false, mensaje, hayLugar: e instanceof ReservasApiError && e.status === 400 && /hay lugar/i.test(mensaje) }
  }
}

// ─── El flujo de la pantalla de reserva ──────────────────────────────────────
//
// Qué sigue a cada toque, sin React: la pantalla (storefront/ReservaReal.tsx)
// guarda este estado y lo dibuja; acá está lo que pasa al tocar "Continuar" y
// al confirmar. Así el camino entero (tomar el lugar, confirmarlo, la lista de
// espera, lo que se venció, la clase que se completó) se prueba sin navegador.

/** Cómo terminó: con el lugar reservado (firme o a confirmar por el negocio) o en la lista de espera. */
export type ReservaTerminada =
  | { tipo: 'reserva'; clase: ClaseDelSitio; codigo: string; pendiente: boolean; nombre: string; email: string | null }
  | { tipo: 'espera'; clase: ClaseDelSitio; posicion: number | null; yaEstaba: boolean; nombre: string; email: string | null }

export interface EstadoDeReserva {
  /** 0 = elegir la clase; 1 = cargar los datos. */
  paso: 0 | 1
  /** Cómo se llegó a los datos: con un lugar tomado, o para anotarse en la lista de espera. */
  camino: 'lugar' | 'espera'
  lugar: LugarTomado | null
  enviando: boolean
  /** Lo que hay que decirle a la persona: un rechazo de la API, la clase que se completó. */
  aviso: string | null
  terminada: ReservaTerminada | null
}

export const RESERVA_INICIAL: EstadoDeReserva = { paso: 0, camino: 'lugar', lugar: null, enviando: false, aviso: null, terminada: null }

export interface DepsDeReserva {
  api: ApiDelSitio
  intento: Intento
  /** El negocio tiene lista de espera: una clase completa se puede elegir para anotarse ahí. */
  listaDeEspera: boolean
  /** Los lugares cambiaron (se reservó, una clase se completó): hay que volver a pedirlos. */
  onCambio: () => void
  /** El instante de ahora (ms): el del sistema, salvo en los tests. */
  reloj?: () => number
}

/** Si el lugar tomado es de esa clase y todavía está guardado. */
export const estaGuardado = (lugar: LugarTomado | null, clase: Pick<ClaseDelSitio, 'recursoId' | 'fecha' | 'inicio'> | null, ahoraMs: number): boolean =>
  !!lugar && !!clase && lugar.firma === firmaDe(clase) && new Date(lugar.hasta).getTime() > ahoraMs

/**
 * "Continuar" con una clase elegida. Con lugar, lo toma y pasa a los datos;
 * si ya lo tenía tomado y sigue guardado, pasa sin pedir nada; con la clase
 * completa va hacia la lista de espera (si el negocio la tiene). Si la clase
 * se completó justo antes, lo dice, se queda en el paso de elegir y pide los
 * lugares de nuevo. Un lugar tomado en otra clase se suelta: no se guardan dos.
 */
export async function continuarReserva(e: EstadoDeReserva, clase: ClaseDelSitio, d: DepsDeReserva, poner: (e: EstadoDeReserva) => void): Promise<void> {
  if (e.enviando) return
  if (estaGuardado(e.lugar, clase, (d.reloj ?? Date.now)())) { poner({ ...e, aviso: null, camino: 'lugar', paso: 1 }); return }
  if (clase.libres === 0) {
    if (d.listaDeEspera) poner({ ...e, aviso: null, camino: 'espera', paso: 1 })
    return
  }
  poner({ ...e, aviso: null, enviando: true })
  if (e.lugar && e.lugar.firma !== firmaDe(clase)) void soltarLugar(d.api, e.lugar)
  const r = await tomarLugar(d.api, d.intento, clase, d.reloj)
  if (r.ok) { poner({ ...e, aviso: null, enviando: false, lugar: r.lugar, camino: 'lugar', paso: 1 }); return }
  if (r.lleno) {
    poner({ ...e, enviando: false, lugar: null, paso: 0, aviso: d.listaDeEspera ? 'Esa clase se acaba de completar. Podés anotarte en la lista de espera o elegir otra.' : 'Esa clase se acaba de completar. Elegí otra.' })
    d.onCambio()
  } else poner({ ...e, enviando: false, lugar: null, aviso: r.mensaje })
}

/**
 * Confirmar, con los datos ya revisados. Con un lugar tomado, lo deja firme;
 * por el camino de la espera, anota en la lista. Si el lugar se venció o la
 * API rechaza algo, lo dice: lo vencido vuelve al paso de elegir, lo demás
 * deja a la persona en el formulario con lo que cargó.
 */
export async function enviarReserva(e: EstadoDeReserva, clase: ClaseDelSitio, datos: DatosDeContacto, d: DepsDeReserva, poner: (e: EstadoDeReserva) => void): Promise<void> {
  if (e.enviando) return
  const nombre = datos.nombre.trim()
  const email = datos.email.trim() || null
  if (e.camino === 'espera') {
    poner({ ...e, aviso: null, enviando: true })
    const r = await anotarEnEspera(d.api, clase, datos)
    if (r.ok) {
      poner({ ...e, aviso: null, enviando: false, terminada: { tipo: 'espera', clase, posicion: r.posicion, yaEstaba: r.yaEstaba, nombre, email } })
      d.onCambio()
    } else if (r.hayLugar) {
      poner({ ...e, enviando: false, paso: 0, aviso: 'Se liberó un lugar en esa clase: ya la podés reservar.' })
      d.onCambio()
    } else poner({ ...e, enviando: false, aviso: r.mensaje })
    return
  }
  if (!e.lugar) { poner({ ...e, paso: 0 }); return }
  poner({ ...e, aviso: null, enviando: true })
  const r = await confirmarLugar(d.api, e.lugar, datos)
  if (r.ok) {
    d.intento.cerrar()
    poner({ ...e, aviso: null, enviando: false, lugar: null, terminada: { tipo: 'reserva', clase, codigo: r.hecha.codigo, pendiente: r.hecha.pendiente, nombre: r.hecha.nombre || nombre, email: r.hecha.email ?? email } })
    d.onCambio()
  } else if (r.vencido) {
    d.intento.cerrar()
    poner({ ...e, enviando: false, lugar: null, paso: 0, aviso: r.mensaje })
    d.onCambio()
  } else poner({ ...e, enviando: false, aviso: r.mensaje })
}
