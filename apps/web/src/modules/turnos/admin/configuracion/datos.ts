// DEMO INTERNA — datos de ejemplo de Configuración del panel de Turnos.
// Solo visual: nada de esto se guarda. Cuando exista el backend, cada bloque de
// acá es la forma que va a tener la config del negocio (apariencia, horarios,
// reglas de reserva, mensajes), no la fuente de datos.
import type { LucideIcon } from 'lucide-react'
import {
  Scissors, Users, Images, Heart, Gift, ListOrdered, MapPin,
  Palette, Building2, Clock, CalendarCog, Bell, Wallet, Globe, Crown, ShieldCheck,
} from 'lucide-react'
import { rubroPorKey, esSalud, type FamiliaId, type RubroTurnos } from '@/modules/turnos/datos'
import { temaDe, type TemaNegocio } from '@/modules/turnos/storefront/tema'

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
// Una plantilla es una identidad completa (paleta, par tipográfico, bordes,
// tipo de portada) con nombre propio. Las cuatro primeras son las identidades
// de storefront/tema.ts (lo que hoy ve cada familia de rubros); el resto son
// alternativas con otro carácter. Elegir una trae sus valores de fábrica y
// después cada cosa se ajusta por separado.

export type Paleta = TemaNegocio['c']
export type EstiloBoton = 'relleno' | 'borde' | 'suave'

export interface PlantillaSitio {
  id: string
  nombre: string
  /** Dos o tres palabras: el carácter visual. */
  caracter: string
  /** Una línea: para qué tipo de negocio va. */
  para: string
  oscuro: boolean
  hero: 'sangre' | 'partido'
  /** id de TIPOGRAFIAS. */
  tipo: string
  radio: number
  boton: EstiloBoton
  c: Paleta
  /** Colores de acento que combinan con el fondo de la plantilla; el primero es el de fábrica. */
  acentos: string[]
  /** Familias de rubros a las que mejor les queda. Vacío = a todas por igual. */
  familias: FamiliaId[]
}

const TEMA_BASE: Record<FamiliaId, TemaNegocio> = {
  belleza: temaDe(rubroPorKey('barberia')), salud: temaDe(rubroPorKey('consulta')),
  deporte: temaDe(rubroPorKey('crossfit')), clases: temaDe(rubroPorKey('talleres')),
}

export const PLANTILLAS: PlantillaSitio[] = [
  { id: 'estudio', nombre: 'Estudio', caracter: 'Oscura y dorada', para: 'Barberías, peluquerías y estudios con oficio y personalidad.',
    oscuro: true, hero: 'sangre', tipo: 'clasica', radio: 4, boton: 'relleno', c: TEMA_BASE.belleza.c,
    acentos: ['#C9A36A', '#D4A5A5', '#B8B8B8', '#E07A5F', '#9C7FD1', '#7FB5A8'], familias: ['belleza'] },
  { id: 'clinica', nombre: 'Clínica', caracter: 'Clara y serena', para: 'Consultorios, odontología y kinesiología: transmite confianza.',
    oscuro: false, hero: 'partido', tipo: 'serena', radio: 16, boton: 'relleno', c: TEMA_BASE.salud.c,
    acentos: ['#0F766E', '#2563EB', '#0E7490', '#7C3AED', '#15803D', '#BE185D'], familias: ['salud'] },
  { id: 'box', nombre: 'Box', caracter: 'Negra y lima', para: 'Gimnasios, crossfit y entrenamiento: pura energía.',
    oscuro: true, hero: 'sangre', tipo: 'impacto', radio: 8, boton: 'relleno', c: TEMA_BASE.deporte.c,
    acentos: ['#D4FF3A', '#FF5A1F', '#38BDF8', '#F43F5E', '#FACC15', '#A78BFA'], familias: ['deporte'] },
  { id: 'taller', nombre: 'Taller', caracter: 'Crema y terracota', para: 'Talleres, cursos y clases donde se trabaja con las manos.',
    oscuro: false, hero: 'partido', tipo: 'editorial', radio: 20, boton: 'relleno', c: TEMA_BASE.clases.c,
    acentos: ['#B4532A', '#6B7F3A', '#2F5D8A', '#A23B5B', '#C28A1E', '#5B4B8A'], familias: ['clases'] },
  { id: 'cosmos', nombre: 'Cosmos', caracter: 'Blanca y azul', para: 'Para cualquier negocio que quiera verse moderno, claro y ordenado.',
    oscuro: false, hero: 'partido', tipo: 'moderna', radio: 12, boton: 'relleno',
    c: { bg: '#FFFFFF', surface: '#F5F8FF', surfaceAlt: '#E8EEFB', border: '#D9E2F3', text: '#0B1533', body: '#33415E', muted: '#5C6B8A', primary: '#2563EB', primaryH: '#1D4ED8', onPrimary: '#FFFFFF', primaryBg: '#E6EEFF' },
    acentos: ['#2563EB', '#4F46E5', '#0E7490', '#7C3AED', '#0F766E', '#BE185D'], familias: [] },
  { id: 'rose', nombre: 'Rosé', caracter: 'Rosa empolvado', para: 'Uñas, pestañas, maquillaje y estética: delicada y luminosa.',
    oscuro: false, hero: 'partido', tipo: 'delicada', radio: 22, boton: 'relleno',
    c: { bg: '#FFF8F6', surface: '#FFFFFF', surfaceAlt: '#FBE9E6', border: '#F1D9D5', text: '#3A1F28', body: '#5C3A45', muted: '#80596A', primary: '#B8446B', primaryH: '#9E365A', onPrimary: '#FFFFFF', primaryBg: '#FBE3EA' },
    acentos: ['#B8446B', '#9C5A3C', '#7B4EA3', '#C2410C', '#2F7A6B', '#9F1239'], familias: ['belleza'] },
  { id: 'calma', nombre: 'Calma', caracter: 'Salvia y arena', para: 'Spa, masajes, yoga y terapias: invita a bajar un cambio.',
    oscuro: false, hero: 'partido', tipo: 'amable', radio: 24, boton: 'suave',
    c: { bg: '#F6F7F2', surface: '#FFFFFF', surfaceAlt: '#E9EDE3', border: '#DCE2D3', text: '#1F2A22', body: '#3D4A40', muted: '#5F6C5A', primary: '#4E7A5B', primaryH: '#3F6649', onPrimary: '#FFFFFF', primaryBg: '#E2EDE4' },
    acentos: ['#4E7A5B', '#8A6A3B', '#3F6F82', '#7A5C86', '#A2543B', '#56642B'], familias: ['belleza', 'deporte', 'salud'] },
  { id: 'nocturna', nombre: 'Nocturna', caracter: 'Azul noche', para: 'Tatuajes, fotografía y estudios que atienden hasta tarde.',
    oscuro: true, hero: 'sangre', tipo: 'nitida', radio: 14, boton: 'relleno',
    c: { bg: '#0A0E1F', surface: '#121833', surfaceAlt: '#1B2347', border: '#283262', text: '#F2F4FF', body: '#C5CBE8', muted: '#8F98C2', primary: '#8B9CFF', primaryH: '#A5B2FF', onPrimary: '#0A0E1F', primaryBg: 'rgba(139,156,255,0.16)' },
    acentos: ['#8B9CFF', '#5EEAD4', '#F0ABFC', '#FDBA74', '#7DD3FC', '#FCA5A5'], familias: ['belleza'] },
  { id: 'cancha', nombre: 'Cancha', caracter: 'Verde césped', para: 'Canchas de fútbol y pádel, clubes y complejos deportivos.',
    oscuro: true, hero: 'sangre', tipo: 'potente', radio: 6, boton: 'relleno',
    c: { bg: '#07140D', surface: '#0E2016', surfaceAlt: '#16301F', border: '#22452E', text: '#F4FBF6', body: '#CFE3D5', muted: '#8FB09A', primary: '#3DDC84', primaryH: '#63E69C', onPrimary: '#04120A', primaryBg: 'rgba(61,220,132,0.14)' },
    acentos: ['#3DDC84', '#FACC15', '#FB923C', '#38BDF8', '#F4F4F5', '#F472B6'], familias: ['deporte'] },
  { id: 'editorial', nombre: 'Editorial', caracter: 'Blanco y negro', para: 'Psicología, nutrición y profesionales independientes: sobria y prolija.',
    oscuro: false, hero: 'partido', tipo: 'editorial', radio: 2, boton: 'borde',
    c: { bg: '#FAFAF7', surface: '#FFFFFF', surfaceAlt: '#EFEFEA', border: '#DEDED6', text: '#141414', body: '#3A3A38', muted: '#66665F', primary: '#141414', primaryH: '#333333', onPrimary: '#FFFFFF', primaryBg: '#ECECE6' },
    acentos: ['#141414', '#B42318', '#1D4ED8', '#7A5C2E', '#0F766E', '#6D28D9'], familias: ['salud', 'clases'] },
]

/** La plantilla con la que arranca cada familia: la identidad que hoy tiene su sitio. */
export const PLANTILLA_DE_FAMILIA: Record<FamiliaId, string> = { belleza: 'estudio', salud: 'clinica', deporte: 'box', clases: 'taller' }

export const plantillaPorId = (id: string | undefined) => PLANTILLAS.find(p => p.id === id)

// Afinidades finas por rubro: suman a la plantilla de fábrica de la familia.
const AFINES: Record<string, string[]> = {
  calma: ['spa', 'yoga', 'estetica', 'medicina-alternativa', 'depilacion'],
  cancha: ['canchas'],
  nocturna: ['tatuajes', 'barberia'],
  rose: ['unas', 'pestanas', 'maquillaje', 'estetica', 'depilacion', 'estilista', 'peluqueria'],
  editorial: ['psico', 'nutricion', 'clases'],
}

/** ¿Le queda especialmente bien a este rubro? */
export function plantillaRecomendada(p: PlantillaSitio, r: RubroTurnos): boolean {
  if (p.id === PLANTILLA_DE_FAMILIA[r.familia]) return true
  return AFINES[p.id]?.includes(r.key) ?? false
}

/** Las recomendadas para el rubro primero; el resto conserva el orden del catálogo. */
export const plantillasPara = (r: RubroTurnos): PlantillaSitio[] =>
  [...PLANTILLAS].sort((a, b) => Number(plantillaRecomendada(b, r)) - Number(plantillaRecomendada(a, r)))

export interface ParTipografico {
  id: string; nombre: string; titulo: string; texto: string; fh: string; fb: string
  /** Títulos en mayúsculas. */
  mayus?: boolean
  /** Specs de Google Fonts, para cargar el par también dentro de la vista previa. */
  google: string[]
}

export const TIPOGRAFIAS: ParTipografico[] = [
  { id: 'clasica', nombre: 'Clásica', titulo: 'Cormorant Garamond', texto: 'Manrope', fh: "'Cormorant Garamond', Georgia, serif", fb: "'Manrope', system-ui, sans-serif", google: ['Cormorant+Garamond:wght@400;500;600;700', 'Manrope:wght@400;600;700;800'] },
  { id: 'serena', nombre: 'Serena', titulo: 'Manrope', texto: 'Inter', fh: "'Manrope', system-ui, sans-serif", fb: "'Inter', system-ui, sans-serif", google: ['Manrope:wght@400;600;700;800', 'Inter:wght@400;600;700;800'] },
  { id: 'impacto', nombre: 'Impacto', titulo: 'Oswald', texto: 'Inter', fh: "'Oswald', Impact, sans-serif", fb: "'Inter', system-ui, sans-serif", mayus: true, google: ['Oswald:wght@400;500;600;700', 'Inter:wght@400;600;700;800'] },
  { id: 'editorial', nombre: 'Editorial', titulo: 'Libre Baskerville', texto: 'Nunito', fh: "'Libre Baskerville', Georgia, serif", fb: "'Nunito', system-ui, sans-serif", google: ['Libre+Baskerville:wght@400;700', 'Nunito:wght@400;600;700;800'] },
  { id: 'moderna', nombre: 'Moderna', titulo: 'Space Grotesk', texto: 'Inter', fh: "'Space Grotesk', system-ui, sans-serif", fb: "'Inter', system-ui, sans-serif", google: ['Space+Grotesk:wght@400;500;700', 'Inter:wght@400;600;700;800'] },
  { id: 'amable', nombre: 'Amable', titulo: 'Quicksand', texto: 'Nunito', fh: "'Quicksand', system-ui, sans-serif", fb: "'Nunito', system-ui, sans-serif", google: ['Quicksand:wght@400;500;600;700', 'Nunito:wght@400;600;700;800'] },
  { id: 'delicada', nombre: 'Delicada', titulo: 'Cormorant Garamond', texto: 'Nunito', fh: "'Cormorant Garamond', Georgia, serif", fb: "'Nunito', system-ui, sans-serif", google: ['Cormorant+Garamond:wght@400;500;600;700', 'Nunito:wght@400;600;700;800'] },
  { id: 'nitida', nombre: 'Nítida', titulo: 'Outfit', texto: 'Inter', fh: "'Outfit', system-ui, sans-serif", fb: "'Inter', system-ui, sans-serif", google: ['Outfit:wght@400;600;700;800', 'Inter:wght@400;600;700;800'] },
  { id: 'potente', nombre: 'Potente', titulo: 'Montserrat', texto: 'Inter', fh: "'Montserrat', system-ui, sans-serif", fb: "'Inter', system-ui, sans-serif", mayus: true, google: ['Montserrat:wght@400;600;800;900', 'Inter:wght@400;600;700;800'] },
  { id: 'cercana', nombre: 'Cercana', titulo: 'Poppins', texto: 'Lato', fh: "'Poppins', system-ui, sans-serif", fb: "'Lato', system-ui, sans-serif", google: ['Poppins:wght@400;600;700;800', 'Lato:wght@400;700'] },
]

export const tipografiaPorId = (id: string) => TIPOGRAFIAS.find(t => t.id === id) ?? TIPOGRAFIAS[0]

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
 * horarios) con la paleta, la tipografía y los bordes de la plantilla. Es lo
 * que reciben las miniaturas y la vista previa.
 */
export function temaConPlantilla(r: RubroTurnos, p: PlantillaSitio): TemaNegocio {
  const tipo = tipografiaPorId(p.tipo)
  return { ...temaDe(r), oscuro: p.oscuro, hero: p.hero, fh: tipo.fh, fb: tipo.fb, mayus: tipo.mayus, radio: p.radio, c: p.c }
}

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

// ─── Helpers de color ────────────────────────────────────────────────────────

const canales = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * Texto legible arriba de un color de fondo: el que más contraste da entre
 * casi negro y blanco. El corte en 0,179 de luminancia es donde los dos
 * contrastes se cruzan; con un corte más alto, el blanco sobre un coral o un
 * dorado quedaba por debajo de 4,5:1.
 */
export function textoSobre(hex: string): string {
  const c = canales(hex)
  if (!c) return '#FFFFFF'
  const [r, g, b] = c.map(v => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '#111111' : '#FFFFFF'
}

export const esHex = (s: string) => /^#[0-9a-f]{6}$/i.test(s)

/** Mezcla dos colores hex: `t` = cuánto del segundo (0 a 1). */
export function mezclar(a: string, b: string, t: number): string {
  const ca = canales(a), cb = canales(b)
  if (!ca || !cb) return a
  return '#' + ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase()
}

/** La paleta de una plantilla con otro color de acento: recalcula lo que depende de él. */
export function paletaCon(p: Paleta, color: string): Paleta {
  if (!esHex(color) || color.toLowerCase() === p.primary.toLowerCase()) return p
  const sobre = textoSobre(color)
  // Si el fondo de la plantilla no es un hex (no pasa hoy), el tinte cae al color con transparencia.
  const tinte = canales(p.bg) ? mezclar(color, p.bg, 0.86) : `color-mix(in srgb, ${color} 14%, transparent)`
  return { ...p, primary: color, primaryH: mezclar(color, sobre === '#FFFFFF' ? '#000000' : '#FFFFFF', 0.14), onPrimary: sobre, primaryBg: tinte }
}

/** Iniciales para el monograma: "Estudio Norte" → "EN". */
export const iniciales = (nombre: string) =>
  nombre.trim().split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase() || 'Ó'

/** Subdominio de ejemplo a partir del nombre del negocio. */
export const subdominioDe = (nombre: string) =>
  nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'minegocio'
