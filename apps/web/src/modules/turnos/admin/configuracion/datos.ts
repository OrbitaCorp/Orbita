// DEMO INTERNA — datos de ejemplo de Configuración del panel de Turnos.
// Casi todo es visual; lo que sí se guarda vive en datos/negocio.ts. Acá van
// las pestañas, cómo se nombra cada cosa según el rubro y lo que Apariencia
// necesita para mostrar y editar las plantillas.
import type { LucideIcon } from 'lucide-react'
import { Scissors, Users, Images, Heart, Gift, ListOrdered, MapPin } from 'lucide-react'
import { esSalud, type RubroTurnos } from '@/modules/turnos/datos'
import type { AparienciaDemo } from '@/modules/turnos/datos/negocio'
import { TIPOGRAFIAS, aplicarPlantilla, type AjustesPlantilla, type EstiloBoton, type PlantillaSitio } from '@/modules/turnos/storefront/plantillas'
import { plantillasDelRubro, temaDe, type TemaNegocio } from '@/modules/turnos/storefront/tema'

// ─── Las sub-secciones de Configuración ──────────────────────────────────────
// Son las del ítem "Configuración" de la barra lateral (viajan en ?tab=). Lo
// que antes vivía adentro de Configuración como pestaña (servicios, equipo,
// espacios, ganancias, reglas, mensajes, pagos) ahora es una sección propia del
// menú: PanelTurnos redirige los links viejos.

export type TabConfig = 'negocio' | 'horarios' | 'apariencia' | 'dominio' | 'suscripcion'

export const SUBS_CONFIG: { id: TabConfig; label: string; separador?: boolean }[] = [
  { id: 'negocio', label: 'Datos del negocio' },
  { id: 'horarios', label: 'Horarios' },
  { id: 'apariencia', label: 'Apariencia' },
  { id: 'dominio', label: 'Dominio' },
  { id: 'suscripcion', label: 'Suscripción', separador: true },
]

/** Los links viejos (?vista=configuracion&tab=…) y la sección del menú a la que van ahora. */
export const TABS_VIEJAS: Record<string, string> = {
  servicios: 'servicios', equipo: 'equipo', espacios: 'espacios', ganancias: 'ganancias', reservas: 'reglas', mensajes: 'mensajes', pagos: 'pagos',
}

// ─── Cómo se nombra cada cosa según el rubro ─────────────────────────────────
// Un consultorio no tiene "clientes" sino "pacientes": el copy de toda la
// configuración sale de acá para no repetir el if en cada pantalla.

export interface Voz {
  /** "clientes" / "pacientes". */
  clientes: string
  cliente: string
  turno: string
  turnos: string
  /** Quien atiende o dónde: "barbero", "consultorio", "cabina". */
  recurso: string
}

export function vozDe(r: RubroTurnos): Voz {
  const clientes = esSalud(r) ? 'pacientes' : 'clientes'
  const cliente = esSalud(r) ? 'paciente' : 'cliente'
  const turno = 'turno'
  const recurso = r.modo === 'profesional' ? r.profesional.toLowerCase() : esSalud(r) ? 'consultorio' : 'cabina'
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
  const equipo = r.modo === 'profesional' ? 'Equipo' : 'Espacios'
  return [
    { id: 'servicios', label: 'Servicios y precios', ayuda: 'Lo que se puede reservar, con duración y precio', Icon: Scissors, on: true },
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
  '/plantillas/libre-lectura.jpg', '/plantillas/libre-cuaderno.jpg', '/plantillas/libre-lapices.jpg',
]

export function fotosPara(t: TemaNegocio): string[] {
  const propias = [t.fotoHero, ...t.galeria]
  return [...new Set([...propias, ...FOTOS_HERO])].slice(0, 12)
}

export function botonesSugeridos(r: RubroTurnos): string[] {
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
