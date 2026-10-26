// Capa de datos de ejemplo de Alquileres (demo local).
//
// Alquileres no tiene backend: todo lo que ven las pantallas de
// /alquileres-demo sale de esta carpeta y vive en memoria o en el navegador.
// La forma de cada cosa (negocio, unidad, propiedad, reserva, cliente) es la
// que tendría la API: el día que exista, cambia el adaptador y no las pantallas.
//
//   index.ts    tipos, catálogo de rubros y los tres negocios de ejemplo (uno por modo)
//   negocio.ts  lo que el dueño cargó o cambió (alta, configuración, reservas nuevas), en el navegador
//
// Un negocio de alquileres reserva de UNA de tres formas, y eso define todo lo
// demás: por hora (canchas, salas de ensayo, boxes), por bloque fijo (salones
// de cumpleaños, quinchos, salas de reunión) o por noches (casas, deptos,
// cabañas). La lógica de disponibilidad y precio es de lib/reservas; acá
// solo están los datos y las reglas de cada modo.
import type { LucideIcon } from 'lucide-react'
import { Trophy, Music, Box, Cake, PartyPopper, Utensils, Presentation, Home, Building2, TreePine, Trees } from 'lucide-react'
import { sumarDias, diaSemana, type ISO } from '@/lib/reservas/fechas'
import { seSolapan, type Tramo } from '@/lib/reservas/solapamiento'
import { armarBloques, bloquesLibres, type Bloque } from '@/lib/reservas/disponibilidad'
import { precioPorHora, senaDe, type Extra, type ReglaFranja } from '@/lib/reservas/precio'
import { precioEstadia, type RangoOcupado, type TarifaEstadia } from '@/lib/reservas/estadia'

// ─── El "hoy" de la demo ─────────────────────────────────────────────────────
// Sábado 14/11/2026 a las 10:40, fijo: así la demo se ve igual cualquier día y
// el servidor y el navegador pintan lo mismo.
export const HOY: ISO = '2026-11-14'
export const AHORA = 10 * 60 + 40

// ─── Modos ───────────────────────────────────────────────────────────────────

export type TipoAlquiler = 'cancha' | 'bloque' | 'estadia'

export interface InfoTipo {
  label: string
  /** Qué se alquila, en una línea. */
  descripcion: string
  Icon: LucideIcon
  /** "cancha", "salón", "propiedad". */
  unidad: string
  unidades: string
  /** El botón principal del sitio. */
  verbo: string
  /** Cómo se llama a quien reserva. */
  cliente: string
  clientes: string
}

export const TIPOS: Record<TipoAlquiler, InfoTipo> = {
  cancha:  { label: 'Canchas o espacios por hora', descripcion: 'Canchas, salas de ensayo, boxes: se reserva por hora, una o varias seguidas.', Icon: Trophy, unidad: 'cancha', unidades: 'canchas', verbo: 'Reservar cancha', cliente: 'cliente', clientes: 'clientes' },
  bloque:  { label: 'Salón para eventos', descripcion: 'Salones de cumpleaños y fiestas, quinchos, salas de reunión: se reserva por bloque, con paquete y extras.', Icon: PartyPopper, unidad: 'salón', unidades: 'salones', verbo: 'Reservar el salón', cliente: 'cliente', clientes: 'eventos' },
  estadia: { label: 'Casa, depto o cabaña', descripcion: 'Alojamiento por noches, con entrada y salida, temporadas y limpieza.', Icon: Home, unidad: 'propiedad', unidades: 'propiedades', verbo: 'Reservar estadía', cliente: 'huésped', clientes: 'huéspedes' },
}
export const TIPOS_ORDEN: TipoAlquiler[] = ['cancha', 'bloque', 'estadia']

export interface RubroAlquiler {
  key: string
  tipo: TipoAlquiler
  label: string
  descripcion: string
  Icon: LucideIcon
}

export const RUBROS_ALQUILERES: RubroAlquiler[] = [
  { key: 'canchas', tipo: 'cancha', label: 'Complejo de canchas', descripcion: 'Fútbol 5, pádel, tenis', Icon: Trophy },
  { key: 'salas-ensayo', tipo: 'cancha', label: 'Salas de ensayo', descripcion: 'Por hora, con equipos', Icon: Music },
  { key: 'boxes', tipo: 'cancha', label: 'Boxes y consultorios por hora', descripcion: 'Para profesionales que alquilan el espacio', Icon: Box },
  { key: 'salon-cumples', tipo: 'bloque', label: 'Salón de cumpleaños', descripcion: 'Infantiles, con paquetes por invitados', Icon: Cake },
  { key: 'salon-eventos', tipo: 'bloque', label: 'Salón de fiestas', descripcion: 'Eventos y celebraciones', Icon: PartyPopper },
  { key: 'quincho', tipo: 'bloque', label: 'Quincho o SUM', descripcion: 'Por bloque, con parrilla', Icon: Utensils },
  { key: 'sala-reuniones', tipo: 'bloque', label: 'Sala de reuniones', descripcion: 'Para empresas y capacitaciones', Icon: Presentation },
  { key: 'casa', tipo: 'estadia', label: 'Casa de vacaciones', descripcion: 'Alquiler temporario por noches', Icon: Home },
  { key: 'depto', tipo: 'estadia', label: 'Departamento temporario', descripcion: 'Uno o varios deptos', Icon: Building2 },
  { key: 'cabana', tipo: 'estadia', label: 'Cabañas', descripcion: 'Complejo de cabañas', Icon: TreePine },
  { key: 'quinta', tipo: 'estadia', label: 'Quinta', descripcion: 'Casa con parque y pileta', Icon: Trees },
]
export const rubroPorKey = (key: string) => RUBROS_ALQUILERES.find(r => r.key === key) ?? RUBROS_ALQUILERES[0]
export const rubrosDe = (tipo: TipoAlquiler) => RUBROS_ALQUILERES.filter(r => r.tipo === tipo)

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

export interface Salon {
  capacidad: number
  /** Minutos que dura cada bloque y minutos de limpieza entre bloques. */
  duracionBloque: number
  limpieza: number
  paquetes: Paquete[]
  extras: Extra[]
  /** Depósito de garantía que se registra (no se cobra desde Órbita). 0 = no pide. */
  deposito: number
  fotos: string[]
}

export interface Propiedad {
  id: string
  nombre: string
  tipo: 'Casa' | 'Departamento' | 'Cabaña' | 'Quinta'
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
  tarifa: TarifaEstadia
  /** Horas de entrada y salida, en minutos desde las 00:00. */
  checkIn: number
  checkOut: number
}

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
  extras: Extra[]
  reglasPrecio: ReglaFranja[]
  // Por bloque
  salon: Salon | null
  // Por noches
  propiedades: Propiedad[]
  bloqueos: Bloqueo[]
  calendariosExternos: CalendarioExterno[]
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
  /** Por noches. */
  entrada?: ISO
  salida?: ISO
  huespedes?: number
  paqueteId?: string
  extras: string[]
  evento?: Evento
  total: number
  sena: number
  senaPagada: boolean
  saldoPagado: boolean
  /** Depósito de garantía (salones): cuánto y si ya se registró. */
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
const FOTOS_SALON = ['/plantillas/regalo-globos.jpg', '/plantillas/comida-torta.jpg', '/plantillas/regalo-juguetes.jpg', '/plantillas/vino-brindis.jpg', '/plantillas/local-salon.jpg']
const FOTOS_CASA = ['/plantillas/casa-interior.jpg', '/plantillas/casa-living.jpg', '/plantillas/casa-living-2.jpg', '/plantillas/casa-sillon.jpg', '/plantillas/casa-moderno.jpg', '/plantillas/casa-deco.jpg', '/plantillas/casa-plantas.jpg', '/plantillas/casa-sofa-naranja.jpg', '/plantillas/casa-ceramica.jpg']

const IGUAZU: [number, number] = [-25.5972, -54.5786]

const BASE = {
  telefono: '3757 55-0101', ciudad: 'Puerto Iguazú', latLng: IGUAZU, logo: null, bloqueos: [] as Bloqueo[], calendariosExternos: [] as CalendarioExterno[],
}

export const NEGOCIOS_DEMO: Record<TipoAlquiler, NegocioAlquiler> = {
  cancha: {
    ...BASE,
    tipo: 'cancha', rubro: 'canchas', nombre: 'Complejo La Cancha', slug: 'lacancha',
    descripcion: 'Cuatro canchas con luz y vestuarios. Reservá por hora, con seña, y el resto lo pagás en el lugar.',
    direccion: 'Av. Tres Fronteras 1450', fotoPortada: FOTOS_CANCHA[0],
    apertura: { dias: [0, 1, 2, 3, 4, 5, 6], desde: 9 * 60, hasta: 24 * 60 },
    senaPct: 50, cancelaHastaHoras: 24,
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
    salon: null, propiedades: [],
  },
  bloque: {
    ...BASE,
    tipo: 'bloque', rubro: 'salon-cumples', nombre: 'Salón Burbujas', slug: 'burbujas',
    descripcion: 'Un salón de cumpleaños para hasta 100 personas, con pelotero, cocina y patio. Paquetes por cantidad de invitados.',
    direccion: 'Av. Victoria Aguirre 820', fotoPortada: FOTOS_SALON[0],
    apertura: { dias: [2, 3, 4, 5, 6], desde: 14 * 60, hasta: 24 * 60 },
    senaPct: 30, cancelaHastaHoras: 72,
    pasoMin: 60, duracionMin: 240, maxFranjas: 1, unidades: [], extras: [], reglasPrecio: [],
    salon: {
      capacidad: 100, duracionBloque: 4 * 60, limpieza: 90, deposito: 50000, fotos: FOTOS_SALON,
      paquetes: [
        { id: 'p30', nombre: 'Hasta 30 invitados', hastaInvitados: 30, precio: 280000, incluye: ['Mesas, sillas y vajilla', 'Pelotero y juegos', 'Una persona de salón'] },
        { id: 'p60', nombre: 'Hasta 60 invitados', hastaInvitados: 60, precio: 420000, incluye: ['Mesas, sillas y vajilla', 'Pelotero y juegos', 'Dos personas de salón', 'Mesa dulce armada'] },
        { id: 'p100', nombre: 'Hasta 100 invitados', hastaInvitados: 100, precio: 620000, incluye: ['Mesas, sillas y vajilla', 'Pelotero y juegos', 'Tres personas de salón', 'Mesa dulce armada', 'Patio exclusivo'] },
      ],
      extras: [
        { id: 'dj', nombre: 'DJ', precio: 90000 },
        { id: 'inflables', nombre: 'Inflables', precio: 60000 },
        { id: 'animador', nombre: 'Animador', precio: 75000 },
        { id: 'mozo', nombre: 'Mozo extra', precio: 35000 },
        { id: 'torta', nombre: 'Torta', precio: 40000 },
        { id: 'deco', nombre: 'Decoración temática', precio: 55000 },
      ],
    },
    propiedades: [],
  },
  estadia: {
    ...BASE,
    tipo: 'estadia', rubro: 'cabana', nombre: 'Cabañas del Bosque', slug: 'cabanasdelbosque',
    descripcion: 'Tres propiedades a diez minutos de las Cataratas: dos cabañas en el bosque y un departamento en el centro.',
    direccion: 'Ruta 12 km 5', fotoPortada: FOTOS_CASA[0],
    apertura: { dias: [0, 1, 2, 3, 4, 5, 6], desde: 0, hasta: 24 * 60 },
    senaPct: 30, cancelaHastaHoras: 7 * 24,
    pasoMin: 60, duracionMin: 60, maxFranjas: 1, unidades: [], extras: [], reglasPrecio: [], salon: null,
    propiedades: [
      {
        id: 'c1', nombre: 'Cabaña Arrayán', tipo: 'Cabaña', descripcion: 'Dos ambientes en el bosque, con deck y parrilla. Silencio, pájaros y a diez minutos del centro.',
        huespedes: 4, ambientes: 2, camas: 2, banos: 1, comodidades: ['Wi-Fi', 'Aire acondicionado', 'Parrilla', 'Cocina equipada', 'Estacionamiento', 'Ropa blanca'],
        fotos: [FOTOS_CASA[0], FOTOS_CASA[1], FOTOS_CASA[5], FOTOS_CASA[6]], direccion: 'Ruta 12 km 5', ciudad: 'Puerto Iguazú', latLng: [-25.6105, -54.5612],
        tarifa: { precioNoche: 68000, temporadas: [{ id: 'alta', nombre: 'Temporada alta', desde: '2026-12-18', hasta: '2027-02-28', precioNoche: 98000 }, { id: 'carnaval', nombre: 'Carnaval', desde: '2027-02-13', hasta: '2027-02-16', precioNoche: 120000 }, { id: 'baja', nombre: 'Temporada baja', desde: '2027-04-05', hasta: '2027-06-30', precioNoche: 56000 }], finDeSemanaPct: 15, limpieza: 25000, minNoches: 2 },
        checkIn: 15 * 60, checkOut: 10 * 60,
      },
      {
        id: 'c2', nombre: 'Cabaña Lapacho', tipo: 'Cabaña', descripcion: 'Tres ambientes con pileta compartida y vista al monte. Ideal para dos familias.',
        huespedes: 6, ambientes: 3, camas: 4, banos: 2, comodidades: ['Wi-Fi', 'Aire acondicionado', 'Pileta', 'Parrilla', 'Cocina equipada', 'Estacionamiento', 'Ropa blanca'],
        fotos: [FOTOS_CASA[2], FOTOS_CASA[3], FOTOS_CASA[4], FOTOS_CASA[8]], direccion: 'Ruta 12 km 5', ciudad: 'Puerto Iguazú', latLng: [-25.6112, -54.5598],
        tarifa: { precioNoche: 92000, temporadas: [{ id: 'alta', nombre: 'Temporada alta', desde: '2026-12-18', hasta: '2027-02-28', precioNoche: 135000 }, { id: 'baja', nombre: 'Temporada baja', desde: '2027-04-05', hasta: '2027-06-30', precioNoche: 76000 }], finDeSemanaPct: 15, limpieza: 32000, minNoches: 2 },
        checkIn: 15 * 60, checkOut: 10 * 60,
      },
      {
        id: 'c3', nombre: 'Depto Centro', tipo: 'Departamento', descripcion: 'Un ambiente luminoso a dos cuadras de la terminal. Para quien viene a recorrer y volver a dormir.',
        huespedes: 2, ambientes: 1, camas: 1, banos: 1, comodidades: ['Wi-Fi', 'Aire acondicionado', 'Cocina', 'Ascensor', 'Ropa blanca'],
        fotos: [FOTOS_CASA[4], FOTOS_CASA[7], FOTOS_CASA[6]], direccion: 'Av. Córdoba 240, 3.º B', ciudad: 'Puerto Iguazú', latLng: [-25.5985, -54.5740],
        tarifa: { precioNoche: 45000, temporadas: [{ id: 'alta', nombre: 'Temporada alta', desde: '2026-12-18', hasta: '2027-02-28', precioNoche: 62000 }], finDeSemanaPct: 0, limpieza: 15000, minNoches: 1 },
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

/** Las unidades reservables de un negocio, sea cual sea el modo: canchas, el salón, o las propiedades. */
export function unidadesDe(n: NegocioAlquiler): { id: string; nombre: string; detalle: string; foto: string }[] {
  if (n.tipo === 'cancha') return n.unidades.map(u => ({ id: u.id, nombre: u.nombre, detalle: u.detalle, foto: u.foto }))
  if (n.tipo === 'bloque') return [{ id: 'salon', nombre: n.nombre, detalle: `Hasta ${n.salon?.capacidad ?? 0} personas`, foto: n.fotoPortada }]
  return n.propiedades.map(p => ({ id: p.id, nombre: p.nombre, detalle: `${p.tipo} · ${p.huespedes} huéspedes`, foto: p.fotos[0] }))
}
export const unidadPorId = (n: NegocioAlquiler, id: string) => unidadesDe(n).find(u => u.id === id)

/** Los bloques fijos del salón: salen del horario, de lo que dura cada uno y de la limpieza entre uno y otro. */
export const bloquesDe = (n: NegocioAlquiler): Bloque[] =>
  n.salon ? armarBloques([n.apertura.desde, n.apertura.hasta], n.salon.duracionBloque, n.salon.limpieza) : []

// ─── Reservas de ejemplo ─────────────────────────────────────────────────────
// Se arman con un patrón fijo (nada de Math.random): las mismas en el servidor
// y en el navegador, y en cada recarga. Cubren un mes para atrás (para que
// Ingresos tenga qué mostrar) y tres semanas para adelante. Los totales salen
// de las mismas reglas de precio que usa el sitio (franjas, temporadas, fin de
// semana, extras), así el detalle de una reserva de ejemplo cierra.

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
      // Entre dos y cuatro reservas por cancha y por día, más a la tarde y a la noche.
      const cuantas = 2 + ((rota(d + ui) + ui) % 3)
      for (let j = 0; j < cuantas; j++) {
        const inicio = 16 * 60 + ((rota(d * 3 + j + ui) + j * 2) % 8) * 60
        const horas = j === 0 && rota(d + j) > 6 ? 2 : 1
        const fin = Math.min(inicio + horas * 60, n.apertura.hasta)
        // Una cancha no se reserva dos veces a la misma hora: si pisa otra del día, no va.
        if (out.some(r => r.unidadId === u.id && r.fecha === fecha && seSolapan([r.inicio!, r.fin!], [inicio, fin]))) continue
        const extras = rota(k + 3) > 7 ? ['luz'] : []
        const total = precioPorHora(u.tarifaHora, fin - inicio, dia, inicio, n.reglasPrecio).final + n.extras.filter(e => extras.includes(e.id)).reduce((s, e) => s + e.precio, 0)
        const sena = senaDe(total, n.senaPct)
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
  const s = n.salon
  if (!s) return out
  const nombres = ['Olivia', 'Benjamín', 'Emma', 'Thiago', 'Martina', 'Bautista', 'Catalina', 'Felipe', 'Isabella', 'Lorenzo']
  const todos = bloquesDe(n)
  let k = 0
  for (let d = -35; d <= 28; d++) {
    const fecha = sumarDias(HOY, d)
    const dia = diaSemana(fecha)
    if (!n.apertura.dias.includes(dia)) continue
    // Los fines de semana se llenan todos los bloques (el último, casi siempre); entre semana, el primero cada tanto.
    const delDia = dia >= 5 ? todos.filter((_, i) => i < todos.length - 1 || rota(d + 3) !== 0) : rota(d) > 5 ? todos.slice(0, 1) : []
    for (const { id: bloqueId, inicio } of delDia) {
      const paquete = s.paquetes[rota(d + k) % s.paquetes.length]
      const extras = s.extras.filter((_, i) => rota(d + i + k) > 6).map(e => e.id)
      const total = paquete.precio + s.extras.filter(e => extras.includes(e.id)).reduce((a, e) => a + e.precio, 0)
      const sena = senaDe(total, n.senaPct)
      const pasada = d < 0
      const estado: EstadoReserva = pasada ? 'completada' : rota(k + 4) === 2 ? 'pendiente' : 'confirmada'
      out.push({
        id: `rb${k++}`, unidadId: 'salon', clienteId: CLIENTES[(d + k + 40) % 10].id, estado, creada: sumarDias(fecha, -(7 + rota(k) * 3)),
        fecha, inicio, fin: inicio + s.duracionBloque, bloqueId, paqueteId: paquete.id, extras,
        evento: { agasajado: nombres[(d + k + 100) % nombres.length], edad: 3 + rota(d + k) % 9, invitados: Math.max(10, paquete.hastaInvitados - rota(d) * 2), notas: rota(k) === 9 ? 'Temática: dinosaurios' : undefined },
        total, sena, senaPagada: estado !== 'pendiente', saldoPagado: estado === 'completada',
        deposito: s.deposito, depositoRegistrado: estado === 'completada' || (estado === 'confirmada' && rota(k + 1) > 4),
      })
    }
  }
  return out
}

function reservasEstadia(n: NegocioAlquiler): Reserva[] {
  const out: Reserva[] = []
  let k = 0
  n.propiedades.forEach((p, pi) => {
    // Estadías de 2 a 5 noches, con huecos entre una y otra.
    let d = -40 + pi * 3
    while (d <= 45) {
      const noches = 2 + (rota(d + pi) % 4)
      const entrada = sumarDias(HOY, d)
      const salida = sumarDias(entrada, noches)
      const choca = n.bloqueos.some(b => b.unidadId === p.id && entrada < b.hasta && b.desde < salida)
      if (!choca) {
        const total = precioEstadia(entrada, salida, p.tarifa).total
        const sena = senaDe(total, n.senaPct)
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

/** Los bloques tomados de un día (por bloque). */
export const bloquesTomadosEn = (reservas: Reserva[], fecha: ISO): string[] =>
  reservas.filter(r => activa(r) && r.fecha === fecha && r.bloqueId).map(r => r.bloqueId!)

/** Los bloques del salón que todavía se pueden reservar ese día: ninguno si el día está bloqueado. */
export const bloquesLibresEn = (n: NegocioAlquiler, reservas: Reserva[], bloques: Bloque[], fecha: ISO): Bloque[] =>
  !n.salon || bloqueoEn(n, 'salon', fecha) ? [] : bloquesLibres(bloques, bloquesTomadosEn(reservas, fecha), n.salon.limpieza)

/** Reservas y bloqueos de una propiedad, como rangos (por noches). */
export function rangosOcupados(n: NegocioAlquiler, reservas: Reserva[], propiedadId: string): RangoOcupado[] {
  return [
    ...reservas.filter(r => activa(r) && r.unidadId === propiedadId && r.entrada && r.salida).map(r => ({ entrada: r.entrada!, salida: r.salida!, id: r.id, tipo: 'reserva' as const })),
    ...n.bloqueos.filter(b => b.unidadId === propiedadId).map(b => ({ entrada: b.desde, salida: b.hasta, id: b.id, tipo: 'bloqueo' as const })),
  ]
}

/** La apertura del día como tramos (vacío si cierra). */
export const aperturaDe = (n: NegocioAlquiler, fecha: ISO): Tramo[] =>
  n.apertura.dias.includes(diaSemana(fecha)) ? [[n.apertura.desde, n.apertura.hasta]] : []

/** El día por el que se ordena y se busca una reserva: el de la cancha o el bloque, o la entrada de la estadía. */
export const fechaDeReserva = (r: Reserva): ISO => r.entrada ?? r.fecha ?? HOY

/** Reservas del día, ordenadas por hora (por hora y por bloque). */
export const reservasDelDia = (reservas: Reserva[], fecha: ISO) =>
  reservas.filter(r => r.fecha === fecha && r.estado !== 'cancelada').sort((a, b) => (a.inicio ?? 0) - (b.inicio ?? 0))
