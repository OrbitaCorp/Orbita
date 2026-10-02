// DEMO INTERNA — datos de ejemplo de Configuración del panel de Turnos.
// Casi todo es visual; lo que sí se guarda vive en demo/negocioDemo.ts. Cuando exista el backend, cada bloque de
// acá es la forma que va a tener la config del negocio (apariencia, horarios,
// reglas de reserva, mensajes), no la fuente de datos.
import type { LucideIcon } from 'lucide-react'
import {
  Scissors, Users, Images, Heart, Gift, ListOrdered, MapPin,
  Palette, Building2, Clock, CalendarCog, Bell, Wallet, Globe, Crown, ShieldCheck,
} from 'lucide-react'
import { esSalud, type RubroTurnos } from '@/modules/turnos/datos'
import type { AparienciaDemo } from '@/modules/turnos/demo/negocioDemo'
import { TIPOGRAFIAS, aplicarPlantilla, type AjustesPlantilla, type EstiloBoton, type PlantillaSitio } from '@/modules/turnos/storefront/plantillas'
import { plantillasDelRubro, temaDe, type TemaNegocio } from '@/modules/turnos/storefront/tema'

// ─── Pestañas ─────────────────────────────────────────────────────────────────

export type TabConfig =
  | 'apariencia' | 'dominio'
  | 'negocio' | 'horarios' | 'reservas' | 'mensajes' | 'pagos'
  | 'equipo' | 'suscripcion'

export interface GrupoNav { label?: string; items: { id: TabConfig; label: string; Icon: LucideIcon }[] }

export const GRUPOS_NAV: GrupoNav[] = [
  { label: 'Tu sitio', items: [
    { id: 'apariencia', label: 'Apariencia', Icon: Palette },
    { id: 'dominio', label: 'Dominio', Icon: Globe },
  ] },
  { label: 'Tu negocio', items: [
    { id: 'negocio', label: 'Datos del negocio', Icon: Building2 },
    { id: 'horarios', label: 'Horarios', Icon: Clock },
    { id: 'reservas', label: 'Reglas de reserva', Icon: CalendarCog },
    { id: 'mensajes', label: 'Recordatorios y mensajes', Icon: Bell },
    { id: 'pagos', label: 'Pagos', Icon: Wallet },
  ] },
  { label: 'Cuenta', items: [
    { id: 'equipo', label: 'Equipo y permisos', Icon: ShieldCheck },
    { id: 'suscripcion', label: 'Suscripción', Icon: Crown },
  ] },
]

export const TABS: TabConfig[] = GRUPOS_NAV.flatMap(g => g.items.map(i => i.id))

// ─── Cómo se nombra cada cosa según el rubro ─────────────────────────────────
// Un consultorio no tiene "clientes" ni un gimnasio "turnos": el copy de toda
// la configuración sale de acá para no repetir el if en cada pantalla.

export interface Voz {
  /** "clientes" / "pacientes" / "alumnos". */
  clientes: string
  cliente: string
  /** "turno" / "clase" / "reserva". */
  turno: string
  turnos: string
  /** "profesional" / "cancha" / "sala". */
  recurso: string
}

export function vozDe(r: RubroTurnos): Voz {
  const clientes = esSalud(r) ? 'pacientes' : r.modo === 'cupo' ? 'alumnos' : 'clientes'
  const cliente = esSalud(r) ? 'paciente' : r.modo === 'cupo' ? 'alumno' : 'cliente'
  const turno = r.modo === 'cupo' ? 'clase' : r.modo === 'cancha' ? 'reserva' : 'turno'
  const recurso = r.modo === 'profesional' ? r.profesional.toLowerCase() : r.modo === 'cancha' ? 'cancha' : r.modo === 'cupo' ? 'sala' : esSalud(r) ? 'consultorio' : 'cabina'
  return { clientes, cliente, turno, turnos: `${turno}s`, recurso }
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// ─── Apariencia: plantillas del sitio ────────────────────────────────────────
// El catálogo vive en storefront/plantillas.ts: cada rubro tiene SUS cinco
// plantillas (una barbería elige entre cinco barberías). Acá está solo lo que
// necesita el panel para mostrarlas y editarlas.

export { TIPOGRAFIAS, tipografiaPorId, paletaCon, esHex, textoSobre, mezclar } from '@/modules/turnos/storefront/plantillas'
export type { Paleta, EstiloBoton, PlantillaSitio, ParTipografico, AjustesPlantilla } from '@/modules/turnos/storefront/plantillas'

/** Las cinco plantillas del rubro; la primera es la de fábrica. */
export const plantillasPara = (r: RubroTurnos): PlantillaSitio[] => plantillasDelRubro(r)

/** La plantilla que el negocio tiene guardada para este rubro o, si no guardó ninguna, la de fábrica. */
export function plantillaEnUso(r: RubroTurnos, guardada: AparienciaDemo | null | undefined): PlantillaSitio {
  const lista = plantillasDelRubro(r)
  return (guardada?.rubro === r.key ? lista.find(p => p.id === guardada.plantilla) : undefined) ?? lista[0]
}

/** Carga las letras de todas las plantillas: las usan las miniaturas y las muestras de tipografía. */
export function cargarFuentesTurnos() {
  if (typeof document === 'undefined') return
  for (const spec of new Set(TIPOGRAFIAS.flatMap(t => t.google))) {
    const id = 'tu-font-' + spec.replace(/\W/g, '')
    if (document.getElementById(id)) continue
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`
    document.head.appendChild(link)
  }
}

export type Radio = 'recto' | 'suave' | 'redondeado' | 'capsula'
export const RADIOS: { id: Radio; label: string; px: number }[] = [
  { id: 'recto', label: 'Recto', px: 2 },
  { id: 'suave', label: 'Suave', px: 8 },
  { id: 'redondeado', label: 'Redondeado', px: 16 },
  { id: 'capsula', label: 'Cápsula', px: 26 },
]
export const radioDeTema = (px: number): Radio => (px <= 4 ? 'recto' : px <= 10 ? 'suave' : px <= 20 ? 'redondeado' : 'capsula')

export const ESTILOS_BOTON: { id: EstiloBoton; label: string; ayuda: string }[] = [
  { id: 'relleno', label: 'Relleno', ayuda: 'El que más se ve' },
  { id: 'borde', label: 'Solo borde', ayuda: 'Liviano y sobrio' },
  { id: 'suave', label: 'Suave', ayuda: 'Fondo tenue del color' },
]

/**
 * La plantilla aplicada al negocio: el tema real del rubro (nombre, fotos,
 * horarios) vestido con la plantilla y, si los hay, con los ajustes del
 * editor. Es lo que reciben las miniaturas y la vista previa.
 */
export const temaConPlantilla = (r: RubroTurnos, p: PlantillaSitio, ajustes?: AjustesPlantilla): TemaNegocio =>
  aplicarPlantilla(temaDe(r), p, ajustes)

export interface SeccionSitio { id: string; label: string; ayuda: string; Icon: LucideIcon; on: boolean }

export function seccionesIniciales(r: RubroTurnos): SeccionSitio[] {
  const equipo = r.modo === 'profesional' ? 'Equipo' : r.modo === 'cancha' ? 'Canchas' : r.modo === 'cupo' ? 'Profes y grilla' : 'Espacios'
  return [
    { id: 'servicios', label: r.modo === 'cupo' ? 'Clases y actividades' : 'Servicios y precios', ayuda: 'Lo que se puede reservar, con duración y precio', Icon: Scissors, on: true },
    { id: 'equipo', label: equipo, ayuda: r.modo === 'profesional' ? 'Fotos y especialidad de quienes atienden' : 'Los espacios disponibles', Icon: Users, on: r.modo !== 'recurso' },
    { id: 'nosotros', label: 'Nosotros', ayuda: 'Quiénes son y cómo trabajan, en pocas líneas', Icon: Heart, on: true },
    { id: 'galeria', label: 'Galería', ayuda: 'Fotos del lugar y de trabajos', Icon: Images, on: true },
    { id: 'beneficios', label: 'Beneficios de la cuenta', ayuda: `Lo que suman tus ${vozDe(r).clientes} si se registran: descuento, sellos y promos`, Icon: Gift, on: true },
    { id: 'como', label: 'Cómo funciona', ayuda: 'Los 3 pasos para reservar', Icon: ListOrdered, on: r.familia !== 'belleza' },
    { id: 'ubicacion', label: 'Ubicación y horarios', ayuda: 'Mapa, dirección y horario de atención', Icon: MapPin, on: true },
  ]
}

/** Fotos para el hero: las del estilo elegido primero, después el resto del banco. */
export const FOTOS_HERO: string[] = [
  '/turnos/bel-hero.jpg', '/turnos/bel-salon.jpg', '/turnos/bel-navaja.jpg', '/turnos/bel-corte.jpg',
  '/plantillas/belleza-spa.jpg', '/plantillas/belleza-maquillaje.jpg', '/plantillas/belleza-manos.jpg',
  '/turnos/sal-hero.jpg', '/turnos/sal-consulta.jpg', '/turnos/sal-dentista.jpg',
  '/turnos/dep-hero.jpg', '/turnos/dep-barra.jpg', '/turnos/dep-yoga.jpg', '/turnos/dep-soga.jpg',
  '/turnos/cla-hero.jpg', '/turnos/cla-torno.jpg', '/turnos/cla-vasija.jpg', '/turnos/cla-manos.jpg',
]

export function fotosPara(t: TemaNegocio): string[] {
  const propias = [t.fotoHero, ...t.galeria]
  return [...new Set([...propias, ...FOTOS_HERO])].slice(0, 12)
}

export function botonesSugeridos(r: RubroTurnos): string[] {
  if (r.modo === 'cupo') return ['Reservá tu clase', 'Anotate', 'Ver horarios']
  if (r.modo === 'cancha') return ['Reservá tu cancha', 'Ver disponibilidad', 'Reservar']
  if (esSalud(r)) return ['Sacá turno', 'Pedí tu turno', 'Reservar consulta']
  return ['Reservá tu turno', 'Sacá turno', 'Reservar ahora']
}

// ─── Textos ──────────────────────────────────────────────────────────────────

/** Iniciales para el monograma: "Estudio Norte" → "EN". */
export const iniciales = (nombre: string) =>
  nombre.trim().split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase() || 'Ó'

/** Subdominio de ejemplo a partir del nombre del negocio. */
export const subdominioDe = (nombre: string) =>
  nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'minegocio'
