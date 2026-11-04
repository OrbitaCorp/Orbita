// Capa de datos de ejemplo de Alquileres (demo local).
//
// Alquileres no tiene backend propio todavía: todo lo que ven las pantallas de
// /alquileres-demo sale de esta carpeta y vive en memoria o en el navegador.
// La forma de cada cosa (negocio, unidad, salón, propiedad, reserva, cliente)
// es la que tiene la API compartida de reservas: el día que se conecte, cambia
// el adaptador y no las pantallas.
//
//   index.ts    tipos, catálogo de rubros y los tres negocios de ejemplo (uno por modo)
//   negocio.ts  lo que el dueño cargó o cambió (alta, configuración, reservas nuevas), en el navegador
//
// Un negocio de alquileres reserva de UNA de tres formas, y eso define todo lo
// demás: por hora (canchas, salas de ensayo, boxes, estudios), por bloque fijo
// (uno o varios salones de cumpleaños, peloteros, quinchos) o por período
// (casas, deptos, cabañas y habitaciones por noche; deptos, cocheras y oficinas
// por mes). Dentro de un modo, el rubro pone las palabras: "canchas" o "salas",
// "huéspedes" o "inquilinos". La lógica de disponibilidad y precio es de
// lib/reservas; acá solo están los datos y las reglas de cada modo.
import type { LucideIcon } from 'lucide-react'
import { BedDouble, Blocks, Box, Briefcase, Building, Building2, Cake, Camera, Car, Home, Laptop, Music, PartyPopper, Presentation, Tent, TreePine, Trees, Trophy, Users, Utensils } from 'lucide-react'
import { diaSemana, diasEntre, sumarDias, type ISO } from '@/lib/reservas/fechas'
import { seSolapan, type Tramo } from '@/lib/reservas/solapamiento'
import { armarBloques, bloquesLibres, type Bloque } from '@/lib/reservas/disponibilidad'
import { precioTurnosSeguidos, senaDe, type Extra, type ReglaFranja } from '@/lib/reservas/precio'
import { precioEstadia, precioMensual, salidaDeMeses, type RangoOcupado, type TarifaEstadia, type TarifaMensual } from '@/lib/reservas/estadia'

// ─── El "hoy" de la demo ─────────────────────────────────────────────────────
// Sábado 14/11/2026 a las 10:40, fijo: así la demo se ve igual cualquier día y
// el servidor y el navegador pintan lo mismo.
export const HOY: ISO = '2026-11-14'
export const AHORA = 10 * 60 + 40

// ─── Modos ───────────────────────────────────────────────────────────────────

export type TipoAlquiler = 'cancha' | 'bloque' | 'estadia'

/** Las palabras con las que el panel y el sitio hablan de lo que se alquila y de quién reserva. */
export interface Palabras {
  /** "cancha", "salón", "propiedad". */
  unidad: string
  unidades: string
  /** El género de la unidad, para "todas las canchas" o "todos los salones". */
  genero: 'f' | 'm'
  /** El botón principal del sitio. */
  verbo: string
  /** Cómo se llama a quien reserva. */
  cliente: string
  clientes: string
}

export interface InfoTipo extends Palabras {
  label: string
  /** Qué se alquila, en una línea. */
  descripcion: string
  Icon: LucideIcon
}

export const TIPOS: Record<TipoAlquiler, InfoTipo> = {
  cancha:  { label: 'Canchas o espacios por hora', descripcion: 'Canchas, salas de ensayo, boxes, estudios: se reserva por hora, una o varias seguidas.', Icon: Trophy, unidad: 'cancha', unidades: 'canchas', genero: 'f', verbo: 'Reservar cancha', cliente: 'cliente', clientes: 'clientes' },
  bloque:  { label: 'Salones para eventos', descripcion: 'Salones de cumpleaños y fiestas, peloteros, quinchos: uno o varios, por bloque, con paquete y extras.', Icon: PartyPopper, unidad: 'salón', unidades: 'salones', genero: 'm', verbo: 'Reservar el salón', cliente: 'cliente', clientes: 'eventos' },
  estadia: { label: 'Alojamiento por noche o por mes', descripcion: 'Casas, deptos, cabañas y habitaciones por noche, con temporadas; deptos, cocheras y oficinas por mes, con depósito.', Icon: Home, unidad: 'propiedad', unidades: 'propiedades', genero: 'f', verbo: 'Reservar estadía', cliente: 'huésped', clientes: 'huéspedes' },
}
export const TIPOS_ORDEN: TipoAlquiler[] = ['cancha', 'bloque', 'estadia']

export interface RubroAlquiler {
  key: string
  tipo: TipoAlquiler
  label: string
  descripcion: string
  Icon: LucideIcon
  /** Lo que el rubro dice distinto que su modo: "salas" en vez de "canchas", "inquilinos" en vez de "huéspedes". */
  palabras?: Partial<Palabras>
}

const INQUILINOS: Partial<Palabras> = { cliente: 'inquilino', clientes: 'inquilinos' }

/** El catálogo del alta: lo que se puede alquilar con Órbita, agrupado por cómo se reserva. */
export const RUBROS_ALQUILERES: RubroAlquiler[] = [
  // Por hora
  { key: 'canchas', tipo: 'cancha', label: 'Complejo de canchas', descripcion: 'Fútbol 5, pádel, tenis', Icon: Trophy },
  { key: 'salas-ensayo', tipo: 'cancha', label: 'Salas de ensayo', descripcion: 'Por hora, con equipos', Icon: Music, palabras: { unidad: 'sala', unidades: 'salas', genero: 'f', verbo: 'Reservar sala' } },
  { key: 'boxes', tipo: 'cancha', label: 'Boxes y consultorios por hora', descripcion: 'Para profesionales que alquilan el espacio', Icon: Box, palabras: { unidad: 'box', unidades: 'boxes', genero: 'm', verbo: 'Reservar box' } },
  { key: 'estudio', tipo: 'cancha', label: 'Estudio de foto o grabación', descripcion: 'Por hora, con equipos y asistente', Icon: Camera, palabras: { unidad: 'estudio', unidades: 'estudios', genero: 'm', verbo: 'Reservar estudio' } },
  { key: 'cowork', tipo: 'cancha', label: 'Coworking', descripcion: 'Puestos y salas por hora', Icon: Laptop, palabras: { unidad: 'espacio', unidades: 'espacios', genero: 'm', verbo: 'Reservar espacio' } },
  { key: 'sala-reuniones', tipo: 'cancha', label: 'Sala de reuniones', descripcion: 'Para empresas y capacitaciones', Icon: Users, palabras: { unidad: 'sala', unidades: 'salas', genero: 'f', verbo: 'Reservar sala' } },
  // Por bloque
  { key: 'salon-cumples', tipo: 'bloque', label: 'Salón de cumpleaños', descripcion: 'Infantiles, con paquetes por invitados', Icon: Cake },
  { key: 'salon-eventos', tipo: 'bloque', label: 'Salón de fiestas', descripcion: 'Eventos y celebraciones', Icon: PartyPopper },
  { key: 'pelotero', tipo: 'bloque', label: 'Pelotero', descripcion: 'Juegos y cumpleaños, por bloque', Icon: Blocks, palabras: { unidad: 'pelotero', unidades: 'peloteros', genero: 'm', verbo: 'Reservar el pelotero' } },
  { key: 'quincho', tipo: 'bloque', label: 'Quincho o SUM', descripcion: 'Por bloque, con parrilla', Icon: Utensils, palabras: { unidad: 'quincho', unidades: 'quinchos', genero: 'm', verbo: 'Reservar el quincho' } },
  { key: 'auditorio', tipo: 'bloque', label: 'Auditorio o sala de capacitación', descripcion: 'Por medio día o día entero', Icon: Presentation, palabras: { unidad: 'sala', unidades: 'salas', genero: 'f', verbo: 'Reservar la sala' } },
  // Por noche
  { key: 'casa', tipo: 'estadia', label: 'Casa de vacaciones', descripcion: 'Alquiler temporario por noches', Icon: Home },
  { key: 'depto', tipo: 'estadia', label: 'Departamento temporario', descripcion: 'Uno o varios deptos', Icon: Building2 },
  { key: 'cabana', tipo: 'estadia', label: 'Cabañas', descripcion: 'Complejo de cabañas', Icon: TreePine },
  { key: 'quinta', tipo: 'estadia', label: 'Quinta', descripcion: 'Casa con parque y pileta', Icon: Trees },
  { key: 'hostel', tipo: 'estadia', label: 'Hostel o posada', descripcion: 'Habitaciones por noche', Icon: BedDouble, palabras: { unidad: 'habitación', unidades: 'habitaciones', genero: 'f', verbo: 'Reservar habitación' } },
  { key: 'camping', tipo: 'estadia', label: 'Camping', descripcion: 'Parcelas y domos por noche', Icon: Tent, palabras: { unidad: 'parcela', unidades: 'parcelas', genero: 'f', verbo: 'Reservar parcela' } },
  // Por mes
  { key: 'depto-mes', tipo: 'estadia', label: 'Departamentos por mes', descripcion: 'Alquiler temporario mensual', Icon: Building, palabras: { unidad: 'depto', unidades: 'deptos', genero: 'm', verbo: 'Alquilar por mes', ...INQUILINOS } },
  { key: 'cochera', tipo: 'estadia', label: 'Cocheras y bauleras', descripcion: 'Por mes, con depósito', Icon: Car, palabras: { unidad: 'cochera', unidades: 'cocheras', genero: 'f', verbo: 'Alquilar cochera', ...INQUILINOS } },
  { key: 'oficina-mes', tipo: 'estadia', label: 'Oficinas y consultorios por mes', descripcion: 'Con contrato de uno o más meses', Icon: Briefcase, palabras: { unidad: 'oficina', unidades: 'oficinas', genero: 'f', verbo: 'Alquilar oficina', ...INQUILINOS } },
]
export const rubroPorKey = (key: string) => RUBROS_ALQUILERES.find(r => r.key === key) ?? RUBROS_ALQUILERES[0]
export const rubrosDe = (tipo: TipoAlquiler) => RUBROS_ALQUILERES.filter(r => r.tipo === tipo)

/** Las palabras de un negocio: las de su modo, con lo que su rubro dice distinto encima. */
export function palabrasDe(n: { tipo: TipoAlquiler; rubro: string }): Palabras {
  const t = TIPOS[n.tipo]
  const r = RUBROS_ALQUILERES.find(x => x.key === n.rubro)
  return { unidad: t.unidad, unidades: t.unidades, genero: t.genero, verbo: t.verbo, cliente: t.cliente, clientes: t.clientes, ...r?.palabras }
}
export const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** "las canchas", "los salones". */
export const lasUnidades = (p: Palabras) => `${p.genero === 'm' ? 'los' : 'las'} ${p.unidades}`
/** "todas las canchas", "todos los salones". */
export const todasLasUnidades = (p: Palabras) => `${p.genero === 'm' ? 'todos' : 'todas'} ${lasUnidades(p)}`
/** "la cancha", "el salón". */
export const laUnidad = (p: Palabras) => `${p.genero === 'm' ? 'el' : 'la'} ${p.unidad}`
/** "cada una", "cada uno". */
export const cadaUna = (p: Palabras) => (p.genero === 'm' ? 'cada uno' : 'cada una')

// ─── El negocio ──────────────────────────────────────────────────────────────

/** Un solo tramo de apertura por día: alcanza para canchas y salones. */
export interface Apertura { dias: number[]; desde: number; hasta: number }

/** Una cancha, una sala, un box: lo que se reserva por hora. */
export interface Unidad {
  id: string
  nombre: string
  /** "Fútbol 5 · césped sintético". */
  detalle: string
  tarifaHora: number
  foto: string
}

export interface Paquete {
  id: string
  nombre: string
  hastaInvitados: number
  precio: number
  incluye: string[]
}

/** Un salón (o un pelotero, un quincho): lo que se reserva por bloque. Un negocio puede tener varios. */
export interface Salon {
  id: string
  nombre: string
  /** "Pelotero y patio · hasta 60". */
  detalle: string
  capacidad: number
  /** Minutos que dura cada bloque y minutos de limpieza entre bloques. */
  duracionBloque: number
  limpieza: number
  /** Los paquetes son de cada salón: el precio depende de cuál se reserva. Los extras son del negocio. */
  paquetes: Paquete[]
  /** Depósito de garantía que se registra (no se cobra desde Órbita). 0 = no pide. */
  deposito: number
  fotos: string[]
}

export const TIPOS_PROPIEDAD = ['Casa', 'Departamento', 'Cabaña', 'Quinta', 'Habitación', 'Cochera', 'Oficina', 'Local'] as const
export type TipoPropiedad = (typeof TIPOS_PROPIEDAD)[number]

/** Cómo se alquila una propiedad: por noche (con entrada y salida) o por mes (una fecha y cuántos meses). */
export type Modalidad = 'noche' | 'mes'

export interface Propiedad {
  id: string
  nombre: string
  tipo: TipoPropiedad
  descripcion: string
  huespedes: number
  ambientes: number
  camas: number
  banos: number
  comodidades: string[]
  fotos: string[]
  direccion: string
  ciudad: string
  latLng: [number, number]
  modalidad: Modalidad
  /** Por noche: precio, temporadas, fin de semana, limpieza y noches mínimas. */
  tarifa: TarifaEstadia
  /** Por mes: precio por mes, mínimo y máximo de meses y depósito. Solo si `modalidad` es 'mes'. */
  mensual?: TarifaMensual
  /** Horas de entrada y salida, en minutos desde las 00:00. */
  checkIn: number
  checkOut: number
}

export const esMensual = (p: Pick<Propiedad, 'modalidad'>) => p.modalidad === 'mes'

export interface Bloqueo {
  id: string
  unidadId: string
  /** [desde, hasta): el día `hasta` ya está libre. */
  desde: ISO
  hasta: ISO
  motivo: string
  /** Lo puso el dueño, o vino de un calendario externo (.ics). */
  origen: 'dueno' | 'ical'
  /** Si vino de un calendario externo, cuál: al desconectarlo se van sus bloqueos. */
  calendarioId?: string
}

export interface CalendarioExterno { id: string; unidadId: string; nombre: string; url: string; ultimaSync: ISO }

// ─── Mensajes automáticos, pagos y equipo ────────────────────────────────────
// Lo que el panel configura en "Recordatorios y mensajes", "Pagos y señas" y
// "Equipo". Es demo: no se manda ningún WhatsApp, no se conecta ninguna cuenta
// de Mercado Pago y no se invita a nadie; pero lo que se guarda acá es lo que
// la API tiene que guardar el día que se conecte.

/** Los cuatro momentos en que el negocio escribe solo. Cada uno se prende o se apaga, y su texto se edita. */
export type MomentoMensaje = 'confirmacion' | 'recordatorio' | 'sena' | 'gracias'
export interface MensajeAuto { id: MomentoMensaje; on: boolean; texto: string }
export interface InfoMensaje { id: MomentoMensaje; titulo: string; cuando: string; ayuda: string }
export const MENSAJES: InfoMensaje[] = [
  { id: 'confirmacion', titulo: 'Confirmación', cuando: 'Apenas reservan', ayuda: 'Con el día, la hora y cuánto falta pagar.' },
  { id: 'recordatorio', titulo: 'Recordatorio', cuando: '24 h antes', ayuda: 'El que más olvidos evita.' },
  { id: 'sena', titulo: 'Seña pendiente', cuando: 'A las 24 h de reservar sin pagar', ayuda: 'Avisa que, si no se paga, el lugar se libera.' },
  { id: 'gracias', titulo: 'Agradecimiento', cuando: 'Al día siguiente', ayuda: 'Para que vuelvan: va con el link para reservar de nuevo.' },
]
/** Lo que se escribe entre llaves en un mensaje y se reemplaza con los datos de la reserva. */
export const VARIABLES_MENSAJE = ['nombre', 'negocio', 'unidad', 'fecha', 'hora', 'total', 'sena', 'saldo', 'link'] as const
export type VariableMensaje = (typeof VARIABLES_MENSAJE)[number]
/** "{nombre}" → "Sofía". Una llave que no existe queda tal cual, para que se vea el error. */
export const rellenarMensaje = (texto: string, datos: Record<VariableMensaje, string>) =>
  texto.replace(/\{([a-z]+)\}/g, (m, k: string) => (Object.hasOwn(datos, k) ? datos[k as VariableMensaje] : m))

export type FormaPago = 'efectivo' | 'transferencia' | 'mercadopago'
export const FORMAS_PAGO: Record<FormaPago, { label: string; ayuda: string }> = {
  efectivo: { label: 'Efectivo', ayuda: 'En el lugar, al llegar.' },
  transferencia: { label: 'Transferencia', ayuda: 'Al alias que se muestra al reservar. La seña se registra a mano.' },
  mercadopago: { label: 'Mercado Pago', ayuda: 'La seña se cobra online al reservar y va directo a tu cuenta.' },
}
export interface Pagos {
  /** Sobre qué se calcula la seña: el total con extras (o limpieza) o solo la cancha, el paquete, las noches o el primer mes. */
  senaSobre: 'total' | 'base'
  formas: FormaPago[]
  /** Datos para transferir: se muestran al reservar si la transferencia está entre las formas. */
  alias: string
  titular: string
  /** Mercado Pago conectado (en la demo se simula: no hay OAuth). */
  mpConectado: boolean
  /** Qué pasa con la seña si cancelan a tiempo (antes de `cancelaHastaHoras`) y si cancelan tarde. */
  cancelaATiempo: 'devolver' | 'credito'
  cancelaTarde: 'pierde' | 'mitad' | 'credito'
}

export type RolEquipo = 'dueno' | 'encargado' | 'recepcion'
export interface Persona { id: string; nombre: string; rol: RolEquipo; telefono: string; email?: string; genero?: 'f' | 'm' }
/** Qué puede hacer cada rol en el panel. El rótulo va en femenino si la persona lo pide. */
export const ROLES: Record<RolEquipo, { label: [string, string]; puede: string }> = {
  dueno: { label: ['Dueño', 'Dueña'], puede: 'Todo: precios, pagos, equipo y la agenda.' },
  encargado: { label: ['Encargado', 'Encargada'], puede: 'La agenda, los cobros y los bloqueos. No cambia precios ni el equipo.' },
  recepcion: { label: ['Recepción', 'Recepción'], puede: 'Ve la agenda, agenda a mano y registra señas. Lo demás, solo lectura.' },
}
export const rolDe = (p: Persona) => ROLES[p.rol].label[p.genero === 'f' ? 1 : 0]

export interface NegocioAlquiler {
  tipo: TipoAlquiler
  rubro: string
  nombre: string
  descripcion: string
  telefono: string
  direccion: string
  ciudad: string
  latLng: [number, number]
  slug: string
  logo: string | null
  fotoPortada: string
  apertura: Apertura
  /** Seña al reservar, en % del total. 0 = sin seña. */
  senaPct: number
  /** Horas antes hasta las que se cancela sin cargo. */
  cancelaHastaHoras: number
  // Por hora
  pasoMin: number
  duracionMin: number
  /** Cuántas franjas seguidas se pueden tomar. */
  maxFranjas: number
  unidades: Unidad[]
  /** Lo que se suma al total si el cliente lo marca: en canchas (luz, pelotas) y en salones (DJ, animador). Son del negocio, no de cada salón. */
  extras: Extra[]
  reglasPrecio: ReglaFranja[]
  // Por bloque: uno o varios salones, cada uno con sus paquetes
  salones: Salon[]
  // Por noche o por mes
  propiedades: Propiedad[]
  bloqueos: Bloqueo[]
  calendariosExternos: CalendarioExterno[]
  mensajes: MensajeAuto[]
  pagos: Pagos
  /** El primero es quien figura como dueño del panel. */
  equipo: Persona[]
}

// ─── Reservas y clientes ─────────────────────────────────────────────────────

export type EstadoReserva = 'pendiente' | 'confirmada' | 'completada' | 'cancelada'

export const ESTADO_RESERVA: Record<EstadoReserva, { label: string; tono: 'ok' | 'aviso' | 'gris' | 'error' }> = {
  pendiente: { label: 'Seña pendiente', tono: 'aviso' },
  confirmada: { label: 'Confirmada', tono: 'ok' },
  completada: { label: 'Realizada', tono: 'gris' },
  cancelada: { label: 'Cancelada', tono: 'error' },
}

export interface Evento {
  /** Quién cumple años (o el nombre del evento). */
  agasajado: string
  edad?: number
  invitados: number
  notas?: string
}

/** "Cumple de Olivia (7)" si hay edad; si no, lo que se festeja tal cual ("Aniversario de la empresa"). */
export const tituloEvento = (e?: Evento) => (!e ? 'Evento' : e.edad ? `Cumple de ${e.agasajado} (${e.edad})` : e.agasajado || 'Evento')

export interface Reserva {
  id: string
  /** La cancha, el salón o la propiedad. */
  unidadId: string
  clienteId: string
  estado: EstadoReserva
  creada: ISO
  /** Por hora y por bloque: el día y el tramo. */
  fecha?: ISO
  inicio?: number
  fin?: number
  /** Por bloque: cuál. */
  bloqueId?: string
  /** Por noche y por mes: la entrada y la salida (la salida ya está libre). */
  entrada?: ISO
  salida?: ISO
  huespedes?: number
  /** Por mes: cuántos meses (la salida es la misma fecha esos meses después). */
  meses?: number
  paqueteId?: string
  extras: string[]
  evento?: Evento
  total: number
  sena: number
  senaPagada: boolean
  saldoPagado: boolean
  /** Depósito de garantía (salones y alquileres por mes): cuánto y si ya se registró. */
  deposito?: number
  depositoRegistrado?: boolean
  nota?: string
}

export interface Cliente {
  id: string
  nombre: string
  telefono: string
  email?: string
  nota?: string
}

// ─── Negocios de ejemplo ─────────────────────────────────────────────────────

const FOTOS_CANCHA = ['/turnos/can-hero.jpg', '/turnos/can-padel.jpg', '/turnos/can-arco.jpg', '/turnos/can-partido.jpg', '/turnos/can-pelota.jpg', '/turnos/can-paletas.jpg']
const FOTOS_SALON = ['/plantillas/regalo-globos.jpg', '/plantillas/comida-torta.jpg', '/plantillas/regalo-juguetes.jpg', '/plantillas/vino-brindis.jpg', '/plantillas/local-salon.jpg', '/plantillas/comida-salon.jpg']
const FOTOS_CASA = ['/plantillas/casa-interior.jpg', '/plantillas/casa-living.jpg', '/plantillas/casa-living-2.jpg', '/plantillas/casa-sillon.jpg', '/plantillas/casa-moderno.jpg', '/plantillas/casa-deco.jpg', '/plantillas/casa-plantas.jpg', '/plantillas/casa-sofa-naranja.jpg', '/plantillas/casa-ceramica.jpg']

const IGUAZU: [number, number] = [-25.5972, -54.5786]

const BASE = {
  telefono: '3757 55-0101', ciudad: 'Puerto Iguazú', latLng: IGUAZU, logo: null, bloqueos: [] as Bloqueo[], calendariosExternos: [] as CalendarioExterno[],
}

/** Los textos de fábrica de los mensajes, con las palabras de cada modo (reserva, evento, estadía). */
export function mensajesDeFabrica(tipo: TipoAlquiler): MensajeAuto[] {
  const que = tipo === 'cancha' ? 'tu reserva' : tipo === 'bloque' ? 'tu evento' : 'tu estadía'
  const cuando = tipo === 'estadia' ? 'entrada el {fecha} desde las {hora}' : '{fecha} a las {hora}'
  return [
    { id: 'confirmacion', on: true, texto: `¡Hola {nombre}! ${que[0].toUpperCase()}${que.slice(1)} en {negocio} quedó agendada: {unidad}, ${cuando}. Seña: {sena}. El resto ({saldo}) se paga en el lugar. Para verla o cancelarla: {link}` },
    { id: 'recordatorio', on: true, texto: tipo === 'estadia' ? `Hola {nombre}, mañana te esperamos en {unidad}: entrada desde las {hora}. Si llegás más tarde, avisanos por acá. ¡Buen viaje!` : `Hola {nombre}, te recordamos ${que} de mañana {fecha} a las {hora} en {negocio} ({unidad}). ¡Te esperamos!` },
    { id: 'sena', on: true, texto: `Hola {nombre}, todavía no nos llegó la seña de {sena} de ${que} del {fecha}. Si no entra hoy, el lugar se libera. Podés pagarla acá: {link}` },
    { id: 'gracias', on: false, texto: `¡Gracias por venir a {negocio}, {nombre}! Cuando quieras volver, reservá acá: {link}` },
  ]
}

const SIN_TARIFA_NOCHE: TarifaEstadia = { precioNoche: 0, temporadas: [], finDeSemanaPct: 0, limpieza: 0, minNoches: 1 }

export const NEGOCIOS_DEMO: Record<TipoAlquiler, NegocioAlquiler> = {
  cancha: {
    ...BASE,
    tipo: 'cancha', rubro: 'canchas', nombre: 'Complejo La Cancha', slug: 'lacancha',
    descripcion: 'Cuatro canchas con luz y vestuarios. Reservá por hora, con seña, y el resto lo pagás en el lugar.',
    direccion: 'Av. Tres Fronteras 1450', fotoPortada: FOTOS_CANCHA[0],
    apertura: { dias: [0, 1, 2, 3, 4, 5, 6], desde: 9 * 60, hasta: 24 * 60 },
    senaPct: 50, cancelaHastaHoras: 24,
    mensajes: mensajesDeFabrica('cancha'),
    pagos: { senaSobre: 'base', formas: ['efectivo', 'transferencia', 'mercadopago'], alias: 'lacancha.mp', titular: 'Martín Acosta', mpConectado: true, cancelaATiempo: 'devolver', cancelaTarde: 'pierde' },
    equipo: [
      { id: 'e1', nombre: 'Martín Acosta', rol: 'dueno', telefono: '3757 55-0101', email: 'martin@lacancha.com.ar' },
      { id: 'e2', nombre: 'Paula Giménez', rol: 'encargado', genero: 'f', telefono: '3757 55-0102' },
      { id: 'e3', nombre: 'Tomás Ferreyra', rol: 'recepcion', telefono: '3757 55-0103' },
    ],
    // Un día de una cancha, el torneo que cierra el complejo entero y uno que ya pasó (así la lista tiene historial).
    bloqueos: [
      { id: 'bl1', unidadId: 'u1', desde: sumarDias(HOY, 3), hasta: sumarDias(HOY, 4), motivo: 'Cambio del césped', origen: 'dueno' },
      ...['u1', 'u2', 'u3', 'u4'].map((u, i) => ({ id: `bl2${i}`, unidadId: u, desde: sumarDias(HOY, 7), hasta: sumarDias(HOY, 8), motivo: 'Torneo interno', origen: 'dueno' as const })),
      { id: 'bl3', unidadId: 'u3', desde: sumarDias(HOY, -10), hasta: sumarDias(HOY, -9), motivo: 'Cancha inundada', origen: 'dueno' },
    ],
    pasoMin: 60, duracionMin: 60, maxFranjas: 3,
    unidades: [
      { id: 'u1', nombre: 'Cancha 1', detalle: 'Fútbol 5 · césped sintético', tarifaHora: 45000, foto: FOTOS_CANCHA[0] },
      { id: 'u2', nombre: 'Cancha 2', detalle: 'Fútbol 5 · techada', tarifaHora: 52000, foto: FOTOS_CANCHA[3] },
      { id: 'u3', nombre: 'Pádel 1', detalle: 'Pádel · cristal panorámico', tarifaHora: 36000, foto: FOTOS_CANCHA[1] },
      { id: 'u4', nombre: 'Tenis', detalle: 'Tenis · polvo de ladrillo', tarifaHora: 28000, foto: FOTOS_CANCHA[5] },
    ],
    extras: [
      { id: 'luz', nombre: 'Iluminación', precio: 5000 },
      { id: 'pelotas', nombre: 'Pelotas', precio: 3000 },
      { id: 'pecheras', nombre: 'Pecheras', precio: 2000 },
    ],
    reglasPrecio: [
      { dias: [0, 1, 2, 3, 4], desde: 9 * 60, hasta: 16 * 60, ajuste: -15 },
      { dias: [], desde: 19 * 60, hasta: 22 * 60, ajuste: 15 },
    ],
    salones: [], propiedades: [],
  },
  bloque: {
    ...BASE,
    tipo: 'bloque', rubro: 'salon-cumples', nombre: 'Burbujas Eventos', slug: 'burbujas',
    descripcion: 'Dos salones para cumpleaños y fiestas: el Jardín, con pelotero y patio, y el Arcoíris, con escenario y cocina. Paquetes por cantidad de invitados.',
    direccion: 'Av. Victoria Aguirre 820', fotoPortada: FOTOS_SALON[0],
    apertura: { dias: [2, 3, 4, 5, 6], desde: 14 * 60, hasta: 24 * 60 },
    senaPct: 30, cancelaHastaHoras: 72,
    mensajes: mensajesDeFabrica('bloque'),
    pagos: { senaSobre: 'total', formas: ['transferencia', 'mercadopago'], alias: 'burbujas.salon', titular: 'Lucía Benítez', mpConectado: false, cancelaATiempo: 'devolver', cancelaTarde: 'credito' },
    equipo: [
      { id: 'e1', nombre: 'Lucía Benítez', rol: 'dueno', genero: 'f', telefono: '3757 55-0101', email: 'lucia@burbujaseventos.com.ar' },
      { id: 'e2', nombre: 'Marcos Ledesma', rol: 'encargado', telefono: '3757 55-0102' },
    ],
    // Un feriado cierra los dos salones; la pintura, solo el Jardín.
    bloqueos: [
      { id: 'bl1', unidadId: 'jardin', desde: '2026-11-20', hasta: '2026-11-21', motivo: 'Feriado', origen: 'dueno' },
      { id: 'bl2', unidadId: 'arcoiris', desde: '2026-11-20', hasta: '2026-11-21', motivo: 'Feriado', origen: 'dueno' },
      { id: 'bl3', unidadId: 'jardin', desde: '2026-11-25', hasta: '2026-11-27', motivo: 'Pintura del salón', origen: 'dueno' },
    ],
    pasoMin: 60, duracionMin: 240, maxFranjas: 1, unidades: [], reglasPrecio: [],
    extras: [
      { id: 'dj', nombre: 'DJ', precio: 90000 },
      { id: 'inflables', nombre: 'Inflables', precio: 60000 },
      { id: 'animador', nombre: 'Animador', precio: 75000 },
      { id: 'mozo', nombre: 'Mozo extra', precio: 35000 },
      { id: 'torta', nombre: 'Torta', precio: 40000 },
      { id: 'deco', nombre: 'Decoración temática', precio: 55000 },
    ],
    salones: [
      {
        id: 'jardin', nombre: 'Salón Jardín', detalle: 'Pelotero y patio · hasta 60', capacidad: 60, duracionBloque: 4 * 60, limpieza: 90, deposito: 50000,
        fotos: [FOTOS_SALON[0], FOTOS_SALON[2], FOTOS_SALON[1], FOTOS_SALON[4]],
        paquetes: [
          { id: 'j30', nombre: 'Hasta 30 invitados', hastaInvitados: 30, precio: 280000, incluye: ['Mesas, sillas y vajilla', 'Pelotero y juegos', 'Una persona de salón'] },
          { id: 'j60', nombre: 'Hasta 60 invitados', hastaInvitados: 60, precio: 420000, incluye: ['Mesas, sillas y vajilla', 'Pelotero y juegos', 'Dos personas de salón', 'Mesa dulce armada'] },
        ],
      },
      {
        id: 'arcoiris', nombre: 'Salón Arcoíris', detalle: 'Escenario y cocina · hasta 120', capacidad: 120, duracionBloque: 4 * 60, limpieza: 90, deposito: 80000,
        fotos: [FOTOS_SALON[5], FOTOS_SALON[3], FOTOS_SALON[4], FOTOS_SALON[1]],
        paquetes: [
          { id: 'a60', nombre: 'Hasta 60 invitados', hastaInvitados: 60, precio: 480000, incluye: ['Mesas, sillas y vajilla', 'Escenario y sonido', 'Dos personas de salón'] },
          { id: 'a100', nombre: 'Hasta 100 invitados', hastaInvitados: 100, precio: 640000, incluye: ['Mesas, sillas y vajilla', 'Escenario y sonido', 'Tres personas de salón', 'Mesa dulce armada'] },
          { id: 'a120', nombre: 'Hasta 120 invitados', hastaInvitados: 120, precio: 760000, incluye: ['Mesas, sillas y vajilla', 'Escenario y sonido', 'Cuatro personas de salón', 'Mesa dulce armada', 'Cocina exclusiva'] },
        ],
      },
    ],
    propiedades: [],
  },
  estadia: {
    ...BASE,
    tipo: 'estadia', rubro: 'cabana', nombre: 'Cabañas del Bosque', slug: 'cabanasdelbosque',
    descripcion: 'Dos cabañas en el bosque por noche, a diez minutos de las Cataratas, y un departamento en el centro que se alquila por mes.',
    direccion: 'Ruta 12 km 5', fotoPortada: FOTOS_CASA[0],
    apertura: { dias: [0, 1, 2, 3, 4, 5, 6], desde: 0, hasta: 24 * 60 },
    senaPct: 30, cancelaHastaHoras: 7 * 24,
    mensajes: mensajesDeFabrica('estadia'),
    pagos: { senaSobre: 'base', formas: ['transferencia', 'mercadopago'], alias: 'cabanas.bosque', titular: 'Carolina Ríos', mpConectado: true, cancelaATiempo: 'devolver', cancelaTarde: 'mitad' },
    equipo: [
      { id: 'e1', nombre: 'Carolina Ríos', rol: 'dueno', genero: 'f', telefono: '3757 55-0101', email: 'carolina@cabanasdelbosque.com.ar' },
      { id: 'e2', nombre: 'Esteban Vera', rol: 'encargado', telefono: '3757 55-0102' },
      { id: 'e3', nombre: 'Mariela Soto', rol: 'recepcion', genero: 'f', telefono: '3757 55-0104' },
    ],
    pasoMin: 60, duracionMin: 60, maxFranjas: 1, unidades: [], extras: [], reglasPrecio: [], salones: [],
    propiedades: [
      {
        id: 'c1', nombre: 'Cabaña Arrayán', tipo: 'Cabaña', modalidad: 'noche', descripcion: 'Dos ambientes en el bosque, con deck y parrilla. Silencio, pájaros y a diez minutos del centro.',
        huespedes: 4, ambientes: 2, camas: 2, banos: 1, comodidades: ['Wi-Fi', 'Aire acondicionado', 'Parrilla', 'Cocina equipada', 'Estacionamiento', 'Ropa blanca'],
        fotos: [FOTOS_CASA[0], FOTOS_CASA[1], FOTOS_CASA[5], FOTOS_CASA[6]], direccion: 'Ruta 12 km 5', ciudad: 'Puerto Iguazú', latLng: [-25.6105, -54.5612],
        tarifa: { precioNoche: 68000, temporadas: [{ id: 'alta', nombre: 'Temporada alta', desde: '2026-12-18', hasta: '2027-02-28', precioNoche: 98000 }, { id: 'carnaval', nombre: 'Carnaval', desde: '2027-02-13', hasta: '2027-02-16', precioNoche: 120000 }, { id: 'baja', nombre: 'Temporada baja', desde: '2027-04-05', hasta: '2027-06-30', precioNoche: 56000 }], finDeSemanaPct: 15, limpieza: 25000, minNoches: 2 },
        checkIn: 15 * 60, checkOut: 10 * 60,
      },
      {
        id: 'c2', nombre: 'Cabaña Lapacho', tipo: 'Cabaña', modalidad: 'noche', descripcion: 'Tres ambientes con pileta compartida y vista al monte. Ideal para dos familias.',
        huespedes: 6, ambientes: 3, camas: 4, banos: 2, comodidades: ['Wi-Fi', 'Aire acondicionado', 'Pileta', 'Parrilla', 'Cocina equipada', 'Estacionamiento', 'Ropa blanca'],
        fotos: [FOTOS_CASA[2], FOTOS_CASA[3], FOTOS_CASA[4], FOTOS_CASA[8]], direccion: 'Ruta 12 km 5', ciudad: 'Puerto Iguazú', latLng: [-25.6112, -54.5598],
        tarifa: { precioNoche: 92000, temporadas: [{ id: 'alta', nombre: 'Temporada alta', desde: '2026-12-18', hasta: '2027-02-28', precioNoche: 135000 }, { id: 'baja', nombre: 'Temporada baja', desde: '2027-04-05', hasta: '2027-06-30', precioNoche: 76000 }], finDeSemanaPct: 15, limpieza: 32000, minNoches: 2 },
        checkIn: 15 * 60, checkOut: 10 * 60,
      },
      {
        // Por mes: la misma propiedad que antes se alquilaba por noche, con contrato de tres meses como mínimo y un mes de depósito.
        id: 'c3', nombre: 'Depto Centro', tipo: 'Departamento', modalidad: 'mes', descripcion: 'Un ambiente luminoso a dos cuadras de la terminal, amoblado y con expensas incluidas. Para quien viene a trabajar o a estudiar una temporada.',
        huespedes: 2, ambientes: 1, camas: 1, banos: 1, comodidades: ['Wi-Fi', 'Aire acondicionado', 'Cocina', 'Ascensor', 'Ropa blanca', 'Expensas incluidas'],
        fotos: [FOTOS_CASA[4], FOTOS_CASA[7], FOTOS_CASA[6]], direccion: 'Av. Córdoba 240, 3.º B', ciudad: 'Puerto Iguazú', latLng: [-25.5985, -54.5740],
        tarifa: SIN_TARIFA_NOCHE, mensual: { precioMes: 520000, minMeses: 3, maxMeses: 12, deposito: 520000 },
        checkIn: 14 * 60, checkOut: 11 * 60,
      },
    ],
    bloqueos: [
      { id: 'bl1', unidadId: 'c1', desde: '2026-11-23', hasta: '2026-11-26', motivo: 'Mantenimiento del deck', origen: 'dueno' },
      { id: 'bl2', unidadId: 'c2', desde: '2026-12-24', hasta: '2026-12-27', motivo: 'Reservado por Airbnb', origen: 'ical', calendarioId: 'ce1' },
    ],
    calendariosExternos: [{ id: 'ce1', unidadId: 'c2', nombre: 'Airbnb · Cabaña Lapacho', url: 'https://www.airbnb.com/calendar/ical/demo.ics', ultimaSync: HOY }],
  },
}

export const CLIENTES: Cliente[] = [
  { id: 'k1', nombre: 'Sofía Ramírez', telefono: '3757 55-1101', email: 'sofia@ejemplo.com', nota: 'Juega los martes' },
  { id: 'k2', nombre: 'Juan Pérez', telefono: '3757 55-1102' },
  { id: 'k3', nombre: 'Valentina Gómez', telefono: '3757 55-1103', email: 'valen@ejemplo.com' },
  { id: 'k4', nombre: 'Nicolás Torres', telefono: '3757 55-1104' },
  { id: 'k5', nombre: 'Camila López', telefono: '3757 55-1105', email: 'cami@ejemplo.com', nota: 'Pidió factura A' },
  { id: 'k6', nombre: 'Mateo Díaz', telefono: '3757 55-1106' },
  { id: 'k7', nombre: 'Agustina Ruiz', telefono: '3757 55-1107', email: 'agus@ejemplo.com' },
  { id: 'k8', nombre: 'Lautaro Castro', telefono: '3757 55-1108' },
  { id: 'k9', nombre: 'Familia Ortiz', telefono: '11 5555-1109', email: 'ortiz@ejemplo.com', nota: 'Vienen con perro' },
  { id: 'k10', nombre: 'Brenda Ojeda', telefono: '11 5555-1110' },
]
export const clientePorId = (id: string, lista: Cliente[] = CLIENTES) => lista.find(c => c.id === id)

/** Las unidades reservables de un negocio, sea cual sea el modo: canchas, salones o propiedades. */
export function unidadesDe(n: NegocioAlquiler): { id: string; nombre: string; detalle: string; foto: string }[] {
  if (n.tipo === 'cancha') return n.unidades.map(u => ({ id: u.id, nombre: u.nombre, detalle: u.detalle, foto: u.foto }))
  if (n.tipo === 'bloque') return n.salones.map(s => ({ id: s.id, nombre: s.nombre, detalle: s.detalle || `Hasta ${s.capacidad} personas`, foto: s.fotos[0] ?? n.fotoPortada }))
  return n.propiedades.map(p => ({ id: p.id, nombre: p.nombre, detalle: esMensual(p) ? `${p.tipo} · por mes` : `${p.tipo} · ${cuenta(p.huespedes, 'huésped', 'huéspedes')}`, foto: p.fotos[0] }))
}
export const unidadPorId = (n: NegocioAlquiler, id: string) => unidadesDe(n).find(u => u.id === id)

/** El salón de una reserva o de un id; con uno solo, ese. */
export const salonDe = (n: NegocioAlquiler, id: string | undefined): Salon | undefined => n.salones.find(s => s.id === id) ?? (n.salones.length === 1 ? n.salones[0] : undefined)

/** Los bloques fijos de un salón: salen del horario del negocio, de lo que dura cada uno y de la limpieza entre uno y otro. */
export const bloquesDe = (n: NegocioAlquiler, s: Salon | undefined): Bloque[] =>
  s ? armarBloques([n.apertura.desde, n.apertura.hasta], s.duracionBloque, s.limpieza) : []

// ─── Reservas de ejemplo ─────────────────────────────────────────────────────
// Se arman con un patrón fijo (nada de Math.random): las mismas en el servidor
// y en el navegador, y en cada recarga. Cubren un mes para atrás (para que
// Ingresos tenga qué mostrar) y tres semanas para adelante. Los totales salen
// de las mismas reglas de precio que usa el sitio (franjas, temporadas, fin de
// semana, extras, meses), así el detalle de una reserva de ejemplo cierra.

const PATRON = [3, 7, 1, 9, 4, 8, 2, 6, 5, 0]
const rota = (i: number) => PATRON[((i % PATRON.length) + PATRON.length) % PATRON.length]

function reservasCancha(n: NegocioAlquiler): Reserva[] {
  const out: Reserva[] = []
  let k = 0
  for (let d = -30; d <= 21; d++) {
    const fecha = sumarDias(HOY, d)
    const dia = diaSemana(fecha)
    if (!n.apertura.dias.includes(dia)) continue
    n.unidades.forEach((u, ui) => {
      // Un día bloqueado (torneo, mantenimiento) no tiene reservas de ejemplo: lo cerró el dueño.
      if (bloqueoEn(n, u.id, fecha)) return
      // Entre dos y cuatro reservas por cancha y por día, más a la tarde y a la noche.
      const cuantas = 2 + ((rota(d + ui) + ui) % 3)
      for (let j = 0; j < cuantas; j++) {
        const inicio = 16 * 60 + ((rota(d * 3 + j + ui) + j * 2) % 8) * 60
        const horas = j === 0 && rota(d + j) > 6 ? 2 : 1
        const fin = Math.min(inicio + horas * 60, n.apertura.hasta)
        // Una cancha no se reserva dos veces a la misma hora: si pisa otra del día, no va.
        if (out.some(r => r.unidadId === u.id && r.fecha === fecha && seSolapan([r.inicio!, r.fin!], [inicio, fin]))) continue
        const extras = rota(k + 3) > 7 ? ['luz'] : []
        const base = precioTurnosSeguidos(u.tarifaHora, n.duracionMin, (fin - inicio) / n.duracionMin, dia, inicio, n.reglasPrecio).final
        const total = base + n.extras.filter(e => extras.includes(e.id)).reduce((s, e) => s + e.precio, 0)
        const sena = senaPara(n, base, total)
        const pasada = d < 0 || (d === 0 && fin <= AHORA)
        const estado: EstadoReserva = pasada ? (rota(k) === 0 ? 'cancelada' : 'completada') : rota(k + 1) === 2 ? 'pendiente' : 'confirmada'
        out.push({
          id: `rc${k++}`, unidadId: u.id, clienteId: CLIENTES[(d + j + ui * 2 + 40) % 8].id, estado, creada: sumarDias(fecha, -(1 + rota(k) % 5)),
          fecha, inicio, fin, extras, total, sena,
          senaPagada: estado !== 'pendiente' && estado !== 'cancelada', saldoPagado: estado === 'completada',
        })
      }
    })
  }
  return out
}

function reservasBloque(n: NegocioAlquiler): Reserva[] {
  const out: Reserva[] = []
  const nombres = ['Olivia', 'Benjamín', 'Emma', 'Thiago', 'Martina', 'Bautista', 'Catalina', 'Felipe', 'Isabella', 'Lorenzo']
  let k = 0
  n.salones.forEach((s, si) => {
    const todos = bloquesDe(n, s)
    for (let d = -35; d <= 28; d++) {
      const fecha = sumarDias(HOY, d)
      const dia = diaSemana(fecha)
      if (!n.apertura.dias.includes(dia) || bloqueoEn(n, s.id, fecha)) continue
      // Los fines de semana el primer salón llena casi todos los bloques y el segundo, la mitad; entre semana, el primero cada tanto.
      const delDia = dia >= 5
        ? todos.filter((_, i) => (si === 0 ? i < todos.length - 1 || rota(d + 3) !== 0 : rota(d + i + si * 3) > 4))
        : rota(d + si * 4) > 5 ? todos.slice(0, 1) : []
      for (const { id: bloqueId, inicio } of delDia) {
        const paquete = s.paquetes[rota(d + k) % s.paquetes.length]
        const extras = n.extras.filter((_, i) => rota(d + i + k) > 6).map(e => e.id)
        const total = paquete.precio + n.extras.filter(e => extras.includes(e.id)).reduce((a, e) => a + e.precio, 0)
        const sena = senaPara(n, paquete.precio, total)
        const pasada = d < 0
        const estado: EstadoReserva = pasada ? 'completada' : rota(k + 4) === 2 ? 'pendiente' : 'confirmada'
        out.push({
          id: `rb${k++}`, unidadId: s.id, clienteId: CLIENTES[(d + k + 40) % 10].id, estado, creada: sumarDias(fecha, -(7 + rota(k) * 3)),
          fecha, inicio, fin: inicio + s.duracionBloque, bloqueId, paqueteId: paquete.id, extras,
          evento: { agasajado: nombres[(d + k + 100 + si * 3) % nombres.length], edad: 3 + rota(d + k) % 9, invitados: Math.max(10, paquete.hastaInvitados - rota(d) * 2), notas: rota(k) === 9 ? 'Temática: dinosaurios' : undefined },
          total, sena, senaPagada: estado !== 'pendiente', saldoPagado: estado === 'completada',
          deposito: s.deposito, depositoRegistrado: estado === 'completada' || (estado === 'confirmada' && rota(k + 1) > 4),
        })
      }
    }
  })
  return out
}

function reservasEstadia(n: NegocioAlquiler): Reserva[] {
  const out: Reserva[] = []
  let k = 0
  n.propiedades.forEach((p, pi) => {
    if (esMensual(p) && p.mensual) {
      // Por mes: un contrato que ya terminó, el que está en curso y uno que empieza más adelante.
      for (const [d, meses] of [[-130, 3], [-25, 3], [80, 4]] as const) {
        const entrada = sumarDias(HOY, d)
        const precio = precioMensual(entrada, meses, p.mensual)
        const choca = n.bloqueos.some(b => b.unidadId === p.id && entrada < b.hasta && b.desde < precio.salida)
        if (choca) continue
        // La seña se calcula sobre el primer mes (o sobre el total, según Pagos y señas).
        const sena = senaPara(n, p.mensual.precioMes, precio.total)
        const estado: EstadoReserva = precio.salida <= HOY ? 'completada' : entrada <= HOY ? 'confirmada' : 'pendiente'
        out.push({
          id: `rm${k++}`, unidadId: p.id, clienteId: CLIENTES[(pi + 8 + k) % 10].id, estado, creada: sumarDias(entrada, -(12 + rota(k) * 2)),
          entrada, salida: precio.salida, meses, huespedes: Math.min(2, p.huespedes), extras: [], total: precio.total, sena,
          senaPagada: estado !== 'pendiente', saldoPagado: estado === 'completada', deposito: p.mensual.deposito, depositoRegistrado: estado !== 'pendiente',
        })
      }
      return
    }
    // Estadías de 2 a 5 noches, con huecos entre una y otra.
    let d = -40 + pi * 3
    while (d <= 45) {
      const noches = 2 + (rota(d + pi) % 4)
      const entrada = sumarDias(HOY, d)
      const salida = sumarDias(entrada, noches)
      const choca = n.bloqueos.some(b => b.unidadId === p.id && entrada < b.hasta && b.desde < salida)
      if (!choca) {
        const precio = precioEstadia(entrada, salida, p.tarifa)
        const total = precio.total
        const sena = senaPara(n, precio.subtotal, total)
        const pasada = d + noches <= 0
        const estado: EstadoReserva = pasada ? (rota(k) === 0 ? 'cancelada' : 'completada') : rota(k + 2) === 1 ? 'pendiente' : 'confirmada'
        out.push({
          id: `re${k++}`, unidadId: p.id, clienteId: CLIENTES[(d + pi + 80) % 10].id, estado, creada: sumarDias(entrada, -(5 + rota(k) * 4)),
          entrada, salida, huespedes: Math.max(1, p.huespedes - (rota(d) % 2)), extras: [], total, sena,
          senaPagada: estado !== 'pendiente' && estado !== 'cancelada', saldoPagado: estado === 'completada',
        })
      }
      d += noches + 1 + (rota(d + 1) % 4)
    }
  })
  return out
}

export function reservasDe(n: NegocioAlquiler): Reserva[] {
  return n.tipo === 'cancha' ? reservasCancha(n) : n.tipo === 'bloque' ? reservasBloque(n) : reservasEstadia(n)
}

// ─── Lecturas que usan el sitio y el panel ───────────────────────────────────

/** "1 noche", "3 noches": el número con la palabra que corresponde (el Depto Centro admite una sola noche). */
export const cuenta = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/**
 * La seña de una reserva: el porcentaje del negocio sobre el total, o solo
 * sobre lo principal (la cancha, el paquete, las noches o el primer mes: sin
 * extras ni limpieza), según lo que diga Pagos y señas.
 */
export const senaPara = (n: NegocioAlquiler, base: number, total: number) => senaDe(n.pagos.senaSobre === 'base' ? base : total, n.senaPct)
export const nochesTxt = (n: number) => cuenta(n, 'noche', 'noches')
export const mesesTxt = (n: number) => cuenta(n, 'mes', 'meses')

/** Cuánto dura una reserva por período: "3 meses" si es por mes, "2 noches" si es por noche. */
export const duracionEstadiaTxt = (r: Pick<Reserva, 'entrada' | 'salida' | 'meses'>) =>
  r.meses ? mesesTxt(r.meses) : r.entrada && r.salida ? nochesTxt(Math.max(0, diasEntre(r.entrada, r.salida))) : ''

const activa = (r: Reserva) => r.estado !== 'cancelada'

/** Los tramos ocupados de una unidad en un día (por hora y por bloque). */
export const ocupadasEn = (reservas: Reserva[], unidadId: string, fecha: ISO): Tramo[] =>
  reservas.filter(r => activa(r) && r.unidadId === unidadId && r.fecha === fecha && r.inicio !== undefined && r.fin !== undefined).map(r => [r.inicio!, r.fin!])

/**
 * El bloqueo que toma ese día en esa unidad, o null. Vale en los tres modos:
 * lo que trae un calendario externo (o lo que bloqueó el dueño) cierra la
 * cancha, el salón o la propiedad ese día.
 */
export const bloqueoEn = (n: NegocioAlquiler, unidadId: string, fecha: ISO): Bloqueo | null =>
  n.bloqueos.find(b => b.unidadId === unidadId && b.desde <= fecha && fecha < b.hasta) ?? null

/** Lo ocupado de una cancha en un día, con los bloqueos: un día bloqueado se ocupa entero. */
export const ocupadoDelDia = (n: NegocioAlquiler, reservas: Reserva[], unidadId: string, fecha: ISO): Tramo[] =>
  bloqueoEn(n, unidadId, fecha) ? [[0, 24 * 60]] : ocupadasEn(reservas, unidadId, fecha)

/** Los bloques tomados de un salón en un día (por bloque). */
export const bloquesTomadosEn = (reservas: Reserva[], salonId: string, fecha: ISO): string[] =>
  reservas.filter(r => activa(r) && r.unidadId === salonId && r.fecha === fecha && r.bloqueId).map(r => r.bloqueId!)

/** Los bloques de un salón que todavía se pueden reservar ese día: ninguno si el día está bloqueado. */
export const bloquesLibresEn = (n: NegocioAlquiler, reservas: Reserva[], s: Salon | undefined, fecha: ISO): Bloque[] =>
  !s || bloqueoEn(n, s.id, fecha) ? [] : bloquesLibres(bloquesDe(n, s), bloquesTomadosEn(reservas, s.id, fecha), s.limpieza)

/** Reservas y bloqueos de una propiedad, como rangos (por noche y por mes). */
export function rangosOcupados(n: NegocioAlquiler, reservas: Reserva[], propiedadId: string): RangoOcupado[] {
  return [
    ...reservas.filter(r => activa(r) && r.unidadId === propiedadId && r.entrada && r.salida).map(r => ({ entrada: r.entrada!, salida: r.salida!, id: r.id, tipo: 'reserva' as const })),
    ...n.bloqueos.filter(b => b.unidadId === propiedadId).map(b => ({ entrada: b.desde, salida: b.hasta, id: b.id, tipo: 'bloqueo' as const })),
  ]
}

/** La salida de un alquiler por mes que empieza ese día. */
export { salidaDeMeses }

/** La apertura del día como tramos (vacío si cierra). */
export const aperturaDe = (n: NegocioAlquiler, fecha: ISO): Tramo[] =>
  n.apertura.dias.includes(diaSemana(fecha)) ? [[n.apertura.desde, n.apertura.hasta]] : []

/** El día por el que se ordena y se busca una reserva: el de la cancha o el bloque, o la entrada de la estadía. */
export const fechaDeReserva = (r: Reserva): ISO => r.entrada ?? r.fecha ?? HOY

/** Reservas del día, ordenadas por hora (por hora y por bloque). */
export const reservasDelDia = (reservas: Reserva[], fecha: ISO) =>
  reservas.filter(r => r.fecha === fecha && r.estado !== 'cancelada').sort((a, b) => (a.inicio ?? 0) - (b.inicio ?? 0))
