// Traducciones de la API de reservas (apps/api/src/reservas, módulo ALQUILERES)
// a los tipos del panel de Alquileres. Puro: sin React ni pedidos, así se prueba solo.
//
// La API habla de recursos (CANCHA, SALON, ALOJAMIENTO), instantes UTC, días
// de Argentina, el domingo en 0 y estados en mayúscula. El panel habla de
// unidades, salones y propiedades, días con el lunes en 0 y estados en
// minúscula. Acá se traduce, en una sola dirección (la API → el panel).
//
// Lo que la API todavía no guarda va con un valor fijo y queda anotado con su
// faltante del diseño (docs/superpowers/specs/2026-11-18-alquileres-sobre-el-backend-design.md, § 6):
//   F2  precios por horario        reglasPrecio = []
//   F3  paquetes por salón         los servicios limitados a cada salón
//   F9  calendarios externos       calendariosExternos = []
//   F10 mensajes                   los de fábrica del modo
//   F11 formas de pago y alias     efectivo y transferencia, sin alias
//   F12 equipo y roles             equipo = []
// Todo lo descriptivo de una propiedad o de un salón vive en `datos` del
// recurso y se lee con cuidado: un campo con otro tipo toma su default.
import type { IngresoExternoApi } from './alquileresApi'
import type { IngresoExterno } from '../index'
import type { Bloqueo as BloqueoApi, CalendarioExterno as CalendarioApi, Config, Estado, Noches, Recurso, Reserva as ReservaApi, Servicio } from '@/lib/reservasApi/tipos'
import type { Extra } from '@/lib/reservas/precio'
import type { Temporada, TarifaMensual } from '@/lib/reservas/estadia'
import { sumarDias, type ISO } from '@/lib/reservas/fechas'
import {
  RUBROS_ALQUILERES, TIPOS_PROPIEDAD, mensajesDeFabrica,
  type Apertura, type Bloqueo, type CalendarioExterno, type Cliente, type EstadoReserva, type NegocioAlquiler, type Paquete, type Propiedad,
  type Reserva, type Salon, type TipoAlquiler, type TipoPropiedad, type Unidad,
} from '../index'

const IGUAZU: [number, number] = [-25.5972, -54.5786]
const TRES_HORAS = 3 * 60 * 60 * 1000
const MINUTOS_DIA = 24 * 60

// ─── Lectura cuidadosa de `datos` ────────────────────────────────────────────

type Datos = Record<string, unknown>
const comoDatos = (d: unknown): Datos => (d && typeof d === 'object' && !Array.isArray(d) ? (d as Datos) : {})
const esNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const esTexto = (v: unknown): v is string => typeof v === 'string'
const esTextos = (v: unknown): v is string[] => Array.isArray(v) && v.every(esTexto)

/** Un campo de `datos` si tiene el tipo esperado; si no, el default. */
function campo<T>(datos: unknown, clave: string, esValido: (v: unknown) => v is T, def: T): T {
  const v = comoDatos(datos)[clave]
  return esValido(v) ? v : def
}

const esExtra = (v: unknown): v is Extra => {
  const x = comoDatos(v)
  return esTexto(x.id) && esTexto(x.nombre) && esNumero(x.precio)
}
const esExtras = (v: unknown): v is Extra[] => Array.isArray(v) && v.every(esExtra)
const esTemporadas = (v: unknown): v is Temporada[] => Array.isArray(v) && v.every(t => {
  const x = comoDatos(t)
  return esTexto(x.id) && esTexto(x.nombre) && esTexto(x.desde) && esTexto(x.hasta) && esNumero(x.precioNoche)
})
const esLatLng = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && v.every(esNumero)
const esTipoPropiedad = (v: unknown): v is TipoPropiedad => esTexto(v) && (TIPOS_PROPIEDAD as readonly string[]).includes(v)
const esModalidad = (v: unknown): v is 'noche' | 'mes' => v === 'noche' || v === 'mes'
const esMensual = (v: unknown): v is TarifaMensual => {
  const x = comoDatos(v)
  return esNumero(x.precioMes) && esNumero(x.minMeses) && esNumero(x.maxMeses) && esNumero(x.deposito)
}

// ─── Fechas y tipos ──────────────────────────────────────────────────────────

/** El día de Argentina (UTC−3, sin horario de verano) de un instante ISO. */
export const fechaArgentina = (iso: string): ISO => new Date(Date.parse(iso) - TRES_HORAS).toISOString().slice(0, 10)

const TIPO_RECURSO: Record<TipoAlquiler, 'CANCHA' | 'SALON' | 'ALOJAMIENTO'> = { cancha: 'CANCHA', bloque: 'SALON', estadia: 'ALOJAMIENTO' }
export const tipoDeRecurso = (tipo: TipoAlquiler) => TIPO_RECURSO[tipo]

/** El modo y el rubro del negocio, del primer subrubro que Alquileres conoce. Sin ninguno, canchas. */
export function tipoDeRubro(subrubros: string[] | null | undefined): { tipo: TipoAlquiler; rubro: string } {
  const r = (subrubros ?? []).map(k => RUBROS_ALQUILERES.find(x => x.key === k)).find(Boolean)
  return r ? { tipo: r.tipo, rubro: r.key } : { tipo: 'cancha', rubro: 'canchas' }
}

/**
 * El estado de la API como estado del panel. VENCIDA no se muestra (fue un
 * lugar retenido que nadie confirmó). AUSENTE va como cancelada: el panel de
 * Alquileres no tiene "no vino" (decisión provisoria, se revisa con Ingresos).
 */
export function estadoDeApi(estado: Estado): EstadoReserva | null {
  switch (estado) {
    case 'VENCIDA': return null
    case 'RETENIDA':
    case 'PENDIENTE': return 'pendiente'
    case 'CONFIRMADA': return 'confirmada'
    case 'COMPLETADA': return 'completada'
    case 'AUSENTE':
    case 'CANCELADA': return 'cancelada'
  }
}

// ─── Lo que se alquila ───────────────────────────────────────────────────────

export function unidadDeApi(r: Recurso): Unidad {
  return {
    id: r.id,
    nombre: r.nombre,
    detalle: r.descripcion ?? '',
    tarifaHora: Math.round((r.precio * 60) / (r.duracionMinutos || 60)),
    foto: campo(r.datos, 'foto', esTexto, ''),
  }
}

/** Un salón con sus paquetes: los servicios activos limitados a ese salón (F3). */
export function salonDeApi(r: Recurso, servicios: Servicio[]): Salon {
  const capacidad = campo(r.datos, 'capacidad', esNumero, 0)
  const paquetes: Paquete[] = servicios
    .filter(s => s.activo && s.recursoIds.includes(r.id))
    .sort((a, b) => a.orden - b.orden)
    .map(s => ({ id: s.id, nombre: s.nombre, precio: s.precio, hastaInvitados: capacidad, incluye: (s.descripcion ?? '').split('\n').map(x => x.trim()).filter(Boolean) }))
  return {
    id: r.id,
    nombre: r.nombre,
    detalle: r.descripcion ?? '',
    capacidad,
    duracionBloque: r.duracionMinutos ?? 240,
    limpieza: r.margenMinutos ?? 0,
    paquetes,
    deposito: campo(r.datos, 'deposito', esNumero, 0),
    fotos: campo(r.datos, 'fotos', esTextos, []),
  }
}

/** Una propiedad: lo de reservar lo usa el servidor (check-in, check-out, noches mínimas); lo demás es para mostrar. */
export function propiedadDeApi(r: Recurso): Propiedad {
  const d = r.datos
  const tarifa = comoDatos(comoDatos(d).tarifa)
  const mensual = comoDatos(d).mensual
  return {
    id: r.id,
    nombre: r.nombre,
    tipo: campo(d, 'tipo', esTipoPropiedad, 'Cabaña'),
    descripcion: r.descripcion ?? '',
    huespedes: campo(d, 'huespedes', esNumero, 2),
    ambientes: campo(d, 'ambientes', esNumero, 1),
    camas: campo(d, 'camas', esNumero, 1),
    banos: campo(d, 'banos', esNumero, 1),
    comodidades: campo(d, 'comodidades', esTextos, []),
    fotos: campo(d, 'fotos', esTextos, []),
    direccion: campo(d, 'direccion', esTexto, ''),
    ciudad: campo(d, 'ciudad', esTexto, ''),
    latLng: campo(d, 'latLng', esLatLng, IGUAZU),
    modalidad: campo(d, 'modalidad', esModalidad, 'noche'),
    tarifa: {
      precioNoche: r.precio,
      temporadas: esTemporadas(tarifa.temporadas) ? tarifa.temporadas : [],
      finDeSemanaPct: esNumero(tarifa.finDeSemanaPct) ? tarifa.finDeSemanaPct : 0,
      limpieza: esNumero(tarifa.limpieza) ? tarifa.limpieza : 0,
      minNoches: campo(d, 'nochesMinimas', esNumero, 1),
    },
    ...(esMensual(mensual) ? { mensual } : {}),
    // Los mismos defaults que datosAlojamiento del servidor (reservas-catalogo.service.ts).
    checkIn: campo(d, 'checkIn', esNumero, 14 * 60),
    checkOut: campo(d, 'checkOut', esNumero, 10 * 60),
  }
}

// ─── Reservas y clientes ─────────────────────────────────────────────────────

/** Quién reservó: la ficha si hay; si no, el teléfono (solo dígitos), el email o el nombre. */
export function clienteIdDe(r: Pick<ReservaApi, 'clienteId' | 'clienteTelefono' | 'clienteEmail' | 'clienteNombre'>): string {
  if (r.clienteId) return r.clienteId
  const tel = (r.clienteTelefono ?? '').replace(/\D/g, '')
  if (tel) return `tel:${tel}`
  const mail = (r.clienteEmail ?? '').trim().toLowerCase()
  if (mail) return `mail:${mail}`
  return `nom:${r.clienteNombre.trim().toLowerCase()}`
}

/** Los clientes de un montón de reservas, uno por persona (la API no tiene lista de clientes de Alquileres: F13). */
export function clientesDeReservas(rs: ReservaApi[]): Cliente[] {
  const porId = new Map<string, Cliente>()
  for (const r of rs) {
    const id = clienteIdDe(r)
    if (porId.has(id)) continue
    porId.set(id, { id, nombre: r.clienteNombre, telefono: r.clienteTelefono ?? '', ...(r.clienteEmail ? { email: r.clienteEmail } : {}) })
  }
  return [...porId.values()]
}

/**
 * Una reserva de la API como reserva del panel, o null si no se muestra. La
 * forma (noches o franja) sale del modo del negocio: así una reserva de una
 * propiedad desactivada o borrada sigue saliendo como estadía.
 */
export function reservaDeApi(r: ReservaApi, tipo: TipoAlquiler): Reserva | null {
  const estado = estadoDeApi(r.estado)
  if (!estado) return null
  const cuando = tipo === 'estadia'
    ? { entrada: r.fecha, salida: fechaArgentina(r.fin) }
    : { fecha: r.fecha, inicio: r.inicioMinutos, fin: r.finMinutos }
  const nota = r.notaInterna ?? r.notas ?? undefined
  const { huespedes, canal } = comoDatos(r.datos)
  return {
    id: r.id,
    codigo: r.codigo,
    canal: r.origen === 'TIENDA' || canal === 'sitio' ? 'sitio' : 'directo',
    unidadId: r.recursoId,
    clienteId: clienteIdDe(r),
    estado,
    creada: fechaArgentina(r.creadaEn),
    ...cuando,
    ...(r.servicioId ? { paqueteId: r.servicioId } : {}),
    extras: (r.extras ?? []).map(e => e.id),
    total: r.precio,
    sena: r.sena,
    senaPagada: r.sena > 0 && r.pagado >= r.sena,
    saldoPagado: r.pagado >= r.precio,
    ...(nota ? { nota } : {}),
    ...(tipo === 'estadia' && esNumero(huespedes) && huespedes > 0 ? { huespedes } : {}),
  }
}

/** Los bloqueos del negocio por unidad: uno de todo el negocio se reparte en cada una, como en la demo. */
export function bloqueosDeApi(bs: BloqueoApi[], unidadIds: string[]): Bloqueo[] {
  return bs.flatMap(b => {
    // Lo que vino de un calendario externo (Airbnb) se distingue: se ve distinto y no se quita a mano.
    const deAfuera = b.origen === 'ICAL'
    const base = { desde: fechaArgentina(b.inicio), hasta: fechaArgentina(b.fin), motivo: b.motivo ?? (deAfuera ? 'Airbnb' : 'Bloqueado'), origen: deAfuera ? 'ical' as const : 'dueno' as const, ...(deAfuera && b.calendarioId ? { calendarioId: b.calendarioId } : {}), ...(deAfuera && b.externoTipo ? { externoTipo: b.externoTipo } : {}) }
    return b.recursoId ? [{ id: b.id, unidadId: b.recursoId, ...base }] : unidadIds.map(u => ({ id: `${b.id}:${u}`, unidadId: u, ...base }))
  })
}

/**
 * Las noches ocupadas de una propiedad (lo único que el sitio público sabe de
 * las reservas ajenas) como bloqueos sin nombre: las noches seguidas se juntan
 * en un rango [desde, hasta), que es como las pantallas calculan lo ocupado.
 */
export function bloqueosDeNoches(n: Pick<Noches, 'recursoId' | 'ocupadas'>): Bloqueo[] {
  const noches = [...new Set(n.ocupadas)].sort()
  const rangos: Bloqueo[] = []
  for (const noche of noches) {
    const ultimo = rangos[rangos.length - 1]
    if (ultimo && ultimo.hasta === noche) ultimo.hasta = sumarDias(noche, 1)
    else rangos.push({ id: `ocupado:${n.recursoId}:${noche}`, unidadId: n.recursoId, desde: noche, hasta: sumarDias(noche, 1), motivo: 'Ocupado', origen: 'dueno' })
  }
  return rangos
}

/**
 * El servidor cobra una estadía noche por noche con la misma cuenta que las
 * pantallas (temporadas, fin de semana y limpieza: apps/api/src/reservas/dominio/estadia.ts).
 * Lo que todavía no sabe cobrar es el alquiler por mes: en un negocio real
 * toda propiedad se alquila por noche.
 */
export const soloPorNoche = (p: Propiedad): Propiedad => ({ ...p, modalidad: 'noche' })

/** Lo que el negocio deja ver en su sitio para coordinar la seña (`datos.publico` de la config de reservas). */
export interface PublicoDeConfig { alias: string; titular: string; telefono: string }

/** Lee `publico` con cuidado: lo que falte o no sea texto queda vacío. */
export function publicoDeConfig(publico: unknown): PublicoDeConfig {
  return { alias: campo(publico, 'alias', esTexto, ''), titular: campo(publico, 'titular', esTexto, ''), telefono: campo(publico, 'telefono', esTexto, '') }
}

/**
 * Un calendario conectado, como lo muestra el panel. `hoy` es para el que
 * todavía no se bajó nunca (su día de sincronización no puede quedar vacío).
 */
export function calendarioDeApi(c: CalendarioApi, hoy: ISO): CalendarioExterno {
  return {
    id: c.id,
    unidadId: c.recursoId,
    nombre: c.nombre,
    url: c.url,
    ultimaSync: c.ultimaSync ? fechaArgentina(c.ultimaSync) : hoy,
    ...(c.ultimaSync ? { ultimaSyncEn: c.ultimaSync } : {}),
    ...(c.ultimoError ? { error: c.ultimoError } : {}),
    ...(typeof c.noches === 'number' ? { noches: c.noches } : {}),
    conflictos: c.conflictos.map(x => ({ reservaId: x.reservaId, codigo: x.codigo, entrada: x.desde, salida: x.hasta })),
  }
}

/** Una estadía cobrada afuera (Airbnb), como la usa el panel: la propiedad, y la plata con los nombres de acá. */
export function ingresoDeApi(i: IngresoExternoApi): IngresoExterno {
  return {
    id: i.id, unidadId: i.recursoId, canal: i.canal, codigo: i.codigo, entrada: i.entrada, salida: i.salida, noches: i.noches,
    ...(i.huesped ? { huesped: i.huesped } : {}),
    neto: i.montoNeto, bruto: i.montoBruto, comision: i.comision, moneda: i.moneda,
  }
}

// ─── El negocio ──────────────────────────────────────────────────────────────

const TODOS_LOS_DIAS = [0, 1, 2, 3, 4, 5, 6]

/**
 * El horario semanal de la API (0 = domingo, varios tramos por día) como la
 * apertura del panel (0 = lunes, un solo tramo): los días con algún tramo,
 * del inicio más temprano al fin más tarde. Sin horario, la estadía está
 * abierta siempre (no tiene apertura: se entra y se sale a la hora de cada
 * propiedad); canchas y salones, cerrados, como los trata el servidor.
 * Todavía no mira el horario propio de cada recurso, que el servidor usa
 * antes que el del negocio.
 */
export function aperturaDeHorario(horario: unknown, tipo: TipoAlquiler): Apertura {
  const h = comoDatos(horario)
  const dias: number[] = []
  let desde = MINUTOS_DIA
  let hasta = 0
  for (const [clave, tramos] of Object.entries(h)) {
    if (!Array.isArray(tramos) || tramos.length === 0) continue
    const domingoEnCero = Number(clave)
    if (!Number.isInteger(domingoEnCero) || domingoEnCero < 0 || domingoEnCero > 6) continue
    dias.push((domingoEnCero + 6) % 7)
    for (const t of tramos) {
      if (Array.isArray(t) && esNumero(t[0]) && esNumero(t[1])) { desde = Math.min(desde, t[0]); hasta = Math.max(hasta, t[1]) }
    }
  }
  if (dias.length === 0 || hasta <= desde) return tipo === 'estadia' ? { dias: TODOS_LOS_DIAS, desde: 0, hasta: MINUTOS_DIA } : { dias: [], desde: 540, hasta: 1080 }
  return { dias: dias.sort((a, b) => a - b), desde, hasta }
}

export interface DatosNegocioApi {
  nombre: string
  slug: string
  telefono?: string | null
  direccion?: string | null
  ciudad?: string | null
  descripcion?: string | null
  logo?: string | null
}

/** Lo que se usa de la config: está tanto en la del panel como en la pública del sitio. */
export type ConfigDelNegocio = Pick<Config, 'horario' | 'senaPorcentaje' | 'cancelacionHastaHoras' | 'senaReembolsable'> & {
  /** Panel: el `datos` entero de la config. */
  datos?: unknown
  /** Sitio: lo único que la config pública deja ver. */
  publico?: unknown
}

/** El negocio del panel a partir de lo que trae la API. `recursos` ya viene filtrado por el modo. */
export function negocioDeApi(p: { tipo: TipoAlquiler; rubro: string; negocio: DatosNegocioApi; config: ConfigDelNegocio; recursos: Recurso[]; servicios: Servicio[]; bloqueos: BloqueoApi[] }): NegocioAlquiler {
  const { tipo, config } = p
  const publico = publicoDeConfig(config.publico ?? comoDatos(config.datos).publico)
  const recursos = [...p.recursos].sort((a, b) => a.orden - b.orden)
  const canchas = tipo === 'cancha' ? recursos : []
  const salones = tipo === 'bloque' ? recursos.map(r => salonDeApi(r, p.servicios)) : []
  const propiedades = tipo === 'estadia' ? recursos.map(propiedadDeApi) : []
  const unidades = canchas.map(unidadDeApi)
  const extras = new Map<string, Extra>()
  for (const c of canchas) for (const e of campo(c.datos, 'extras', esExtras, [])) if (!extras.has(e.id)) extras.set(e.id, e)
  const primera = canchas[0]
  const fotoPortada = unidades[0]?.foto || salones[0]?.fotos[0] || propiedades[0]?.fotos[0] || ''
  return {
    tipo,
    rubro: p.rubro,
    nombre: p.negocio.nombre,
    descripcion: p.negocio.descripcion ?? '',
    // El WhatsApp para reservas que cargó en su panel; si no, el del negocio.
    telefono: publico.telefono || (p.negocio.telefono ?? ''),
    direccion: p.negocio.direccion ?? '',
    ciudad: p.negocio.ciudad ?? '',
    latLng: propiedades[0]?.latLng ?? IGUAZU,
    slug: p.negocio.slug,
    logo: p.negocio.logo ?? null,
    fotoPortada,
    apertura: aperturaDeHorario(config.horario, tipo),
    senaPct: config.senaPorcentaje,
    cancelaHastaHoras: config.cancelacionHastaHoras,
    pasoMin: primera?.pasoMinutos ?? 60,
    duracionMin: primera?.duracionMinutos ?? 60,
    maxFranjas: primera?.maximoSeguidos ?? 1,
    unidades,
    extras: [...extras.values()],
    reglasPrecio: [],
    salones,
    propiedades,
    bloqueos: bloqueosDeApi(p.bloqueos, recursos.map(r => r.id)),
    calendariosExternos: [],
    mensajes: mensajesDeFabrica(tipo),
    pagos: { senaSobre: 'total', formas: ['efectivo', 'transferencia'], alias: publico.alias, titular: publico.titular, mpConectado: false, cancelaATiempo: config.senaReembolsable ? 'devolver' : 'pierde', cancelaTarde: 'pierde' },
    equipo: [],
  }
}

// ─── El sitio público ────────────────────────────────────────────────────────

/** Lo que el sitio usa de la config pública de la tienda (GET /storefront/:slug). */
export interface TiendaDelSitio {
  business: { name: string; subdomain: string; subrubros?: string[] | null }
  appearance: { storeName: string | null; tagline: string | null; logoUrl: string | null } | null
  contact: { whatsapp: string | null } | null
  payment: { transferAlias: string | null; transferHolder: string | null } | null
}

/**
 * El negocio como lo ve un visitante, armado solo con lo público: la config de
 * la tienda, la de reservas, los recursos activos y las noches ocupadas de cada
 * propiedad (que entran como bloqueos sin nombre: el sitio no conoce las
 * reservas de otros). La dirección del negocio es la de su primera propiedad;
 * el WhatsApp y el alias, los que cargó en su panel (`publico` de la config).
 */
export function negocioDelSitio(p: { tienda: TiendaDelSitio; config: ConfigDelNegocio; recursos: Recurso[]; noches: Pick<Noches, 'recursoId' | 'ocupadas'>[] }): { tipo: TipoAlquiler; negocio: NegocioAlquiler } {
  const { tienda } = p
  const { tipo, rubro } = tipoDeRubro(tienda.business.subrubros)
  const recursos = p.recursos.filter(r => r.activo && r.tipo === tipoDeRecurso(tipo))
  const armado = negocioDeApi({
    tipo, rubro, config: p.config, recursos, servicios: [], bloqueos: [],
    negocio: {
      nombre: tienda.appearance?.storeName?.trim() || tienda.business.name,
      slug: tienda.business.subdomain,
      telefono: tienda.contact?.whatsapp,
      descripcion: tienda.appearance?.tagline,
      logo: tienda.appearance?.logoUrl,
    },
  })
  const propiedades = armado.propiedades.map(soloPorNoche)
  const ids = new Set(recursos.map(r => r.id))
  return {
    tipo,
    negocio: {
      ...armado,
      propiedades,
      direccion: propiedades[0]?.direccion ?? '',
      ciudad: propiedades[0]?.ciudad ?? '',
      bloqueos: p.noches.filter(n => ids.has(n.recursoId)).flatMap(bloqueosDeNoches),
      // El alias que cargó en su panel de Alquileres; si no cargó ninguno, el de la tienda (si tiene).
      pagos: armado.pagos.alias ? armado.pagos : { ...armado.pagos, alias: tienda.payment?.transferAlias ?? '', titular: tienda.payment?.transferHolder ?? '' },
    },
  }
}
