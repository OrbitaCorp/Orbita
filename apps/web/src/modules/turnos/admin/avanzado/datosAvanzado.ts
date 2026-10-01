// DEMO INTERNA — catálogo y datos de ejemplo del "Avanzado" de Turnos.
// Solo visual: ningún número de acá sale de un negocio real ni se guarda. Los
// montos están en ARS y se derivan de los servicios del rubro (datos.ts) para
// que cada rubro vea precios coherentes con lo que cobra.
import type { LucideIcon } from 'lucide-react'
import {
  Package, Crown, Gift, Stamp, Hourglass, CalendarSync, ClipboardCheck, HeartHandshake,
  QrCode, BadgePercent, Star, LayoutTemplate, CalendarPlus, Repeat2, Wallet, Palette,
} from 'lucide-react'
import { CLIENTES, type RubroTurnos, type ServicioTipo } from '@/modules/turnos/datos'

// ─── Catálogo de funciones ────────────────────────────────────────────────────

export type FuncionId =
  | 'paquetes' | 'membresias' | 'gift-cards' | 'fidelidad' | 'lista-espera' | 'turno-fijo'
  | 'formularios' | 'recuperar' | 'boton-reserva' | 'precios-horario' | 'resenas' | 'plantillas'

export type GrupoId = 'llenar' | 'vuelvan' | 'cobrar' | 'imagen'

// Cada grupo es un objetivo del negocio, con su ícono y su color: en el hub el
// color del grupo tiñe el ícono de cada función, así se lee de qué familia es
// sin leer el título.
export const GRUPOS: { id: GrupoId; label: string; corto: string; desc: string; Icon: LucideIcon; tono: string }[] = [
  { id: 'llenar', label: 'Llenar la agenda', corto: 'Llenar', desc: 'Que los huecos libres se ocupen solos y te encuentren más fácil.', Icon: CalendarPlus, tono: 'var(--color-primary)' },
  { id: 'vuelvan', label: 'Fidelizar', corto: 'Fidelizar', desc: 'Convertir un turno suelto en un cliente de todos los meses.', Icon: Repeat2, tono: '#DB2777' },
  { id: 'cobrar', label: 'Cobrar mejor', corto: 'Cobrar', desc: 'Plata por adelantado y cada turno llega con todo resuelto.', Icon: Wallet, tono: 'var(--color-success)' },
  { id: 'imagen', label: 'Tu imagen', corto: 'Imagen', desc: 'Cómo te ven antes de conocerte: tu sitio y lo que dicen de vos.', Icon: Palette, tono: '#8B5CF6' },
]

export const grupoPorId = (id: GrupoId) => GRUPOS.find(g => g.id === id) ?? GRUPOS[0]

export interface Funcion {
  id: FuncionId
  grupo: GrupoId
  label: string
  /** Una línea: qué gana el negocio. */
  desc: string
  Icon: LucideIcon
  /** No tiene interruptor: es una galería (Plantillas), no algo que se prende o se apaga. */
  externa?: boolean
  recomendada: (r: RubroTurnos) => boolean
}

const en = (...keys: string[]) => (r: RubroTurnos) => keys.includes(r.key)

export const FUNCIONES: Funcion[] = [
  // Llenar la agenda
  { id: 'lista-espera', grupo: 'llenar', label: 'Lista de espera inteligente', Icon: Hourglass,
    desc: 'Si alguien cancela, le avisamos por WhatsApp a la lista y el primero que confirma se queda el turno.',
    recomendada: r => r.modo === 'cupo' || r.modo === 'cancha' || ['barberia', 'odonto', 'pestanas', 'tatuajes'].includes(r.key) },
  { id: 'turno-fijo', grupo: 'llenar', label: 'Turno fijo', Icon: CalendarSync,
    desc: 'Tu cliente reserva el mismo horario cada semana o cada quince días, sin volver a pedirlo.',
    recomendada: en('psico', 'kinesio', 'fono', 'nutricion', 'clases', 'canchas', 'medicina-alternativa', 'podologia') },
  { id: 'boton-reserva', grupo: 'llenar', label: 'Botón de reserva para Instagram y Google', Icon: QrCode,
    desc: 'Un link, un QR y un botón para tu web: que te reserven desde donde te encuentran.',
    recomendada: r => r.familia === 'belleza' || r.key === 'canchas' },
  { id: 'precios-horario', grupo: 'llenar', label: 'Precios por horario', Icon: BadgePercent,
    desc: 'Descuento en los horarios flojos (o recargo en los picos) para repartir mejor la demanda.',
    recomendada: en('canchas', 'electro', 'spa', 'depilacion', 'estetica') },

  // Que vuelvan
  { id: 'fidelidad', grupo: 'vuelvan', label: 'Programa de fidelidad', Icon: Stamp,
    desc: 'Tarjeta de sellos digital: cada tantos turnos, uno gratis o un descuento.',
    recomendada: en('barberia', 'peluqueria', 'unas', 'pestanas', 'estilista', 'depilacion') },
  { id: 'recuperar', grupo: 'vuelvan', label: 'Recuperar clientes', Icon: HeartHandshake,
    desc: 'Campaña "te extrañamos" automática para quienes no vuelven hace un tiempo.',
    recomendada: r => r.familia === 'belleza' || ['odonto', 'nutricion', 'podologia'].includes(r.key) },

  // Cobrar y cuidar el tiempo
  { id: 'paquetes', grupo: 'cobrar', label: 'Paquetes y bonos', Icon: Package,
    desc: 'Vendé packs de sesiones por adelantado (ej. 10 de kinesio) y descontá cada turno solo.',
    recomendada: en('kinesio', 'estetica', 'electro', 'depilacion', 'spa', 'pestanas', 'fono', 'medicina-alternativa', 'clases', 'medicina-estetica') },
  { id: 'membresias', grupo: 'cobrar', label: 'Membresías y abonos', Icon: Crown,
    desc: 'Planes mensuales con clases por semana o libre, con renovación automática.',
    recomendada: r => r.modo === 'cupo' },
  { id: 'gift-cards', grupo: 'cobrar', label: 'Gift cards', Icon: Gift,
    desc: 'Regalá un turno: tarjetas de regalo por monto o por servicio, listas para mandar.',
    recomendada: r => r.familia === 'belleza' || r.key === 'talleres' },
  { id: 'formularios', grupo: 'cobrar', label: 'Formularios y consentimientos', Icon: ClipboardCheck,
    desc: 'Preguntas antes del turno y consentimiento con firma: llegan resueltos a la sesión.',
    recomendada: r => r.familia === 'salud' || ['tatuajes', 'estetica', 'depilacion', 'pestanas'].includes(r.key) },

  // Tu imagen
  { id: 'plantillas', grupo: 'imagen', label: 'Plantillas del sitio', Icon: LayoutTemplate, externa: true,
    desc: 'Diez identidades completas para tu sitio de reservas: mirá cómo queda el tuyo con cada una y aplicala.',
    recomendada: () => false },
  { id: 'resenas', grupo: 'imagen', label: 'Reseñas después del turno', Icon: Star,
    desc: 'Un mensaje unas horas después del turno pidiendo una opinión, con link a Google.',
    recomendada: r => r.familia === 'belleza' || r.familia === 'salud' },
]

export const funcionPorId = (id: string) => FUNCIONES.find(f => f.id === id)

/** Arranque de la demo: algunas prendidas para que el hub no se vea vacío. */
export const ACTIVAS_INICIALES: Record<FuncionId, boolean> = {
  paquetes: false, membresias: false, 'gift-cards': true, fidelidad: false, 'lista-espera': true, 'turno-fijo': false,
  formularios: false, recuperar: false, 'boton-reserva': true, 'precios-horario': false, resenas: false, plantillas: false,
}

// ─── Formato ──────────────────────────────────────────────────────────────────

/** Pesos sin el "Incluido" de datos.ts: acá un 0 es un 0. */
export const ars = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`

/** Servicio "típico" del rubro: el primero con precio (los de cupo tienen precio 0). */
export function servicioBase(r: RubroTurnos): ServicioTipo {
  return r.servicios.find(s => s.precio > 0 && !/pack/i.test(s.nombre)) ?? { nombre: 'Clase suelta', duracion: 60, precio: 10000 }
}

/** Servicios que tiene sentido vender en pack (no packs ni gratis). */
export const serviciosVendibles = (r: RubroTurnos) => {
  const l = r.servicios.filter(s => s.precio > 0 && !/pack/i.test(s.nombre))
  return l.length ? l : [servicioBase(r)]
}

/** Nombre del negocio → subdominio de ejemplo (sin tildes ni espacios). */
export const slugDe = (n: string) => n.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')

/** Redondeo "de vidriera" a miles. */
export const redondear = (n: number) => Math.round(n / 1000) * 1000

// ─── Paquetes ─────────────────────────────────────────────────────────────────

export interface Paquete {
  id: string
  servicio: string
  sesiones: number
  precio: number
  /** Días de validez; 0 = no vence. */
  vence: number
  vendidos: number
}

export function paquetesDe(r: RubroTurnos): Paquete[] {
  const vs = serviciosVendibles(r)
  const a = vs[0]
  const b = vs[1] ?? vs[0]
  return [
    { id: 'p1', servicio: a.nombre, sesiones: 10, precio: redondear(a.precio * 10 * 0.85), vence: 120, vendidos: 14 },
    { id: 'p2', servicio: a.nombre, sesiones: 4, precio: redondear(a.precio * 4 * 0.92), vence: 60, vendidos: 23 },
    { id: 'p3', servicio: b.nombre, sesiones: 6, precio: redondear(b.precio * 6 * 0.88), vence: 90, vendidos: 6 },
  ]
}

/** Clientes con un pack en curso (de ejemplo). */
export const USOS_PAQUETE = [
  { cliente: CLIENTES[0].nombre, paquete: 'p1', usadas: 7, vence: '12/11' },
  { cliente: CLIENTES[2].nombre, paquete: 'p2', usadas: 3, vence: '04/10' },
  { cliente: CLIENTES[4].nombre, paquete: 'p1', usadas: 2, vence: '20/12' },
  { cliente: CLIENTES[6].nombre, paquete: 'p3', usadas: 5, vence: '30/10' },
]

// ─── Membresías ───────────────────────────────────────────────────────────────

export interface PlanMembresia {
  id: string
  nombre: string
  /** Clases por semana; 0 = libre. */
  porSemana: number
  precio: number
  destacado?: boolean
}

export function planesDe(r: RubroTurnos): PlanMembresia[] {
  // La clase suelta del rubro marca el piso de precio del abono.
  const suelta = r.servicios.find(s => /suelta|pase/i.test(s.nombre))?.precio ?? servicioBase(r).precio
  return [
    { id: 'm1', nombre: '2 veces por semana', porSemana: 2, precio: redondear(suelta * 8 * 0.45) },
    { id: 'm2', nombre: '3 veces por semana', porSemana: 3, precio: redondear(suelta * 12 * 0.38), destacado: true },
    { id: 'm3', nombre: 'Pase libre', porSemana: 0, precio: redondear(suelta * 20 * 0.3) },
  ]
}

// ─── Lista de espera ──────────────────────────────────────────────────────────

export const EN_ESPERA = [
  { cliente: 'Sofía Ramírez', franja: 'Lun 28/09 · tarde', frecuente: true, desde: 'hace 2 días' },
  { cliente: 'Nicolás Torres', franja: 'Lun 28/09 · cualquier horario', frecuente: false, desde: 'hace 1 día' },
  { cliente: 'Valentina Gómez', franja: 'Mar 29/09 · 18 a 20 h', frecuente: true, desde: 'hace 5 h' },
  { cliente: 'Lautaro Castro', franja: 'Mié 30/09 · mañana', frecuente: false, desde: 'hace 3 h' },
]

// ─── Recuperar clientes ───────────────────────────────────────────────────────

/** Cuántos clientes (de ejemplo) no vuelven hace N días o más. */
export const INACTIVOS_POR_DIAS: Record<number, number> = { 30: 48, 45: 37, 60: 29, 90: 18, 120: 11 }
export const MUESTRA_INACTIVOS = [
  { nombre: 'Juan Pérez', ultima: 'hace 64 días', visitas: 3 },
  { nombre: 'Lautaro Castro', ultima: 'hace 71 días', visitas: 2 },
  { nombre: 'Rocío Medina', ultima: 'hace 88 días', visitas: 6 },
  { nombre: 'Ezequiel Funes', ultima: 'hace 95 días', visitas: 4 },
  { nombre: 'Brenda Ojeda', ultima: 'hace 132 días', visitas: 9 },
]
/** Supuesto que usamos para estimar, no un dato del negocio. */
export const TASA_RETORNO_ESTIMADA = 0.15

// ─── Formularios ──────────────────────────────────────────────────────────────

export type TipoPregunta = 'corta' | 'larga' | 'si-no' | 'opciones' | 'fecha'
export const TIPOS_PREGUNTA: { id: TipoPregunta; label: string }[] = [
  { id: 'corta', label: 'Texto corto' },
  { id: 'larga', label: 'Texto largo' },
  { id: 'si-no', label: 'Sí / No' },
  { id: 'opciones', label: 'Opción múltiple' },
  { id: 'fecha', label: 'Fecha' },
]
export interface Pregunta { id: string; texto: string; tipo: TipoPregunta; obligatoria: boolean; opciones?: string[] }

/** Preguntas de arranque según el rubro: se editan libremente. */
export function preguntasDe(r: RubroTurnos): Pregunta[] {
  if (r.key === 'tatuajes') return [
    { id: 'q1', texto: '¿Tenés alguna alergia (látex, tintas, antisépticos)?', tipo: 'si-no', obligatoria: true },
    { id: 'q2', texto: 'Zona del cuerpo y tamaño aproximado', tipo: 'corta', obligatoria: true },
    { id: 'q3', texto: '¿Tomás anticoagulantes o algún medicamento?', tipo: 'si-no', obligatoria: true },
    { id: 'q4', texto: 'Fecha de nacimiento', tipo: 'fecha', obligatoria: true },
  ]
  if (r.familia === 'salud') return [
    { id: 'q1', texto: 'Motivo de la consulta', tipo: 'larga', obligatoria: true },
    { id: 'q2', texto: '¿Tomás alguna medicación?', tipo: 'si-no', obligatoria: true },
    { id: 'q3', texto: 'Cobertura', tipo: 'opciones', obligatoria: true, opciones: ['Particular', 'OSDE', 'Swiss Medical', 'Otra'] },
    { id: 'q4', texto: 'Fecha de nacimiento', tipo: 'fecha', obligatoria: false },
  ]
  return [
    { id: 'q1', texto: '¿Tenés alguna alergia o sensibilidad en la piel?', tipo: 'si-no', obligatoria: true },
    { id: 'q2', texto: '¿Es tu primera vez con este tratamiento?', tipo: 'si-no', obligatoria: false },
    { id: 'q3', texto: 'Tipo de piel', tipo: 'opciones', obligatoria: false, opciones: ['Seca', 'Mixta', 'Grasa', 'No sé'] },
    { id: 'q4', texto: 'Algo que quieras contarnos antes', tipo: 'larga', obligatoria: false },
  ]
}

export function consentimientoDe(r: RubroTurnos): string {
  const que = r.key === 'tatuajes' ? 'el tatuaje o piercing' : r.familia === 'salud' ? 'la práctica' : 'el tratamiento'
  return `Declaro que la información que completé es verdadera. Me explicaron en qué consiste ${que}, sus cuidados posteriores y los posibles efectos. Acepto realizarlo y autorizo el uso de estos datos solo para mi atención.`
}

// ─── Precios por horario ──────────────────────────────────────────────────────

export interface Franja { id: string; dias: string; desde: string; hasta: string; ajuste: number }
export const FRANJAS_INICIALES: Franja[] = [
  { id: 'f1', dias: 'Lun a jue', desde: '09:00', hasta: '12:00', ajuste: -15 },
  { id: 'f2', dias: 'Lun a vie', desde: '14:00', hasta: '16:00', ajuste: -10 },
]

/** Ocupación de ejemplo por día (lun–sáb) y franja de 2 h, 0–100. */
export const OCUPACION: number[][] = [
  [35, 48, 52, 70, 92, 88],
  [30, 44, 50, 74, 95, 90],
  [38, 51, 49, 72, 90, 84],
  [33, 46, 55, 78, 97, 93],
  [55, 62, 60, 85, 98, 96],
  [80, 94, 90, 76, 60, 0],
]
export const FRANJAS_OCUPACION = ['9–11', '11–13', '13–15', '15–17', '17–19', '19–21']
