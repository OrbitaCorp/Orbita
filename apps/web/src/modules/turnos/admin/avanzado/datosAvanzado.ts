// DEMO INTERNA — catálogo y datos de ejemplo del "Avanzado" de Turnos.
// Solo visual: ningún número de acá sale de un negocio real ni se guarda. Los
// montos están en ARS y se derivan de los servicios del rubro (datos/) para
// que cada rubro vea precios coherentes con lo que cobra.
import type { LucideIcon } from 'lucide-react'
import { Package, Crown, BadgePercent, CalendarPlus, Wallet } from 'lucide-react'
import { CLIENTES, type RubroTurnos, type ServicioTipo } from '@/modules/turnos/datos'

// ─── Catálogo de funciones ────────────────────────────────────────────────────
// Tres funciones, las que un negocio de turnos usa de verdad: repartir la
// demanda con precios por horario y cobrar por adelantado con packs y abonos.

export type FuncionId = 'paquetes' | 'membresias' | 'precios-horario'

export type GrupoId = 'llenar' | 'cobrar'

// Cada grupo es un objetivo del negocio, con su ícono: en el hub cada grupo es
// un bloque con su título, así se lee de qué familia es cada función sin leer
// la descripción. Un solo color de acento para todos (el estándar del panel).
export const GRUPOS: { id: GrupoId; label: string; corto: string; desc: string; Icon: LucideIcon }[] = [
  { id: 'llenar', label: 'Llenar la agenda', corto: 'Llenar', desc: 'Que los horarios flojos se ocupen.', Icon: CalendarPlus },
  { id: 'cobrar', label: 'Cobrar mejor', corto: 'Cobrar', desc: 'Plata por adelantado: packs y abonos.', Icon: Wallet },
]

export const grupoPorId = (id: GrupoId) => GRUPOS.find(g => g.id === id) ?? GRUPOS[0]

export interface Funcion {
  id: FuncionId
  grupo: GrupoId
  label: string
  /** Una línea: qué gana el negocio. */
  desc: string
  Icon: LucideIcon
  recomendada: (r: RubroTurnos) => boolean
}

const en = (...keys: string[]) => (r: RubroTurnos) => keys.includes(r.key)

export const FUNCIONES: Funcion[] = [
  // Llenar la agenda
  { id: 'precios-horario', grupo: 'llenar', label: 'Precios por horario', Icon: BadgePercent,
    desc: 'Descuento en los horarios flojos para repartir mejor la demanda.',
    recomendada: en('electro', 'spa', 'depilacion', 'estetica') },

  // Cobrar por adelantado
  { id: 'paquetes', grupo: 'cobrar', label: 'Paquetes y bonos', Icon: Package,
    desc: 'Vendé packs de sesiones por adelantado (ej. 10 de kinesio) y descontá cada turno solo.',
    recomendada: en('kinesio', 'estetica', 'electro', 'depilacion', 'spa', 'pestanas', 'fono', 'medicina-alternativa', 'clases', 'medicina-estetica') },
  { id: 'membresias', grupo: 'cobrar', label: 'Membresías y abonos', Icon: Crown,
    desc: 'Planes mensuales con turnos por semana o libre, con renovación automática.',
    recomendada: en('estetica', 'spa', 'depilacion', 'electro', 'kinesio') },
]

export const funcionPorId = (id: string) => FUNCIONES.find(f => f.id === id)

/** Arranque de la demo: una prendida para que el hub no se vea vacío. */
export const ACTIVAS_INICIALES: Record<FuncionId, boolean> = { paquetes: true, membresias: false, 'precios-horario': false }

// ─── Formato ──────────────────────────────────────────────────────────────────

/** Pesos sin el "Incluido" de datos/index.ts: acá un 0 es un 0. */
export const ars = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`

/** Servicio "típico" del rubro: el primero con precio que no sea un pack (una consulta gratis no sirve de base). */
export function servicioBase(r: RubroTurnos): ServicioTipo {
  return r.servicios.find(s => s.precio > 0 && !/pack/i.test(s.nombre)) ?? { nombre: 'Sesión', duracion: 60, precio: 10000 }
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
  /** Turnos por semana; 0 = libre. */
  porSemana: number
  precio: number
  destacado?: boolean
}

export function planesDe(r: RubroTurnos): PlanMembresia[] {
  // El turno suelto del servicio típico marca el piso de precio del abono.
  const suelta = servicioBase(r).precio
  return [
    { id: 'm1', nombre: '2 veces por semana', porSemana: 2, precio: redondear(suelta * 8 * 0.45) },
    { id: 'm2', nombre: '3 veces por semana', porSemana: 3, precio: redondear(suelta * 12 * 0.38), destacado: true },
    { id: 'm3', nombre: 'Pase libre', porSemana: 0, precio: redondear(suelta * 20 * 0.3) },
  ]
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
