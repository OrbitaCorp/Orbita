// Las secciones del panel de Alquileres, por modo, y cómo se lee la URL. Puro
// (sin React ni íconos: los pone Panel.tsx), así se prueba solo.
//
// Contrato de la URL: ?tipo=<modo>&vista=<sección>&tab=<sub-sección de
// Configuración>. Cada modo tiene su barra lateral: lo de hoy (la agenda, qué
// hay libre, la gente o los eventos, los ingresos), lo que se alquila (las
// canchas, los salones o las propiedades, con sus extras, paquetes y precios),
// las reglas de la reserva (reglas, bloqueos, mensajes, pagos), los calendarios
// externos y la configuración del negocio (datos, horarios, equipo).
//
// Las palabras del grupo de lo que se alquila son las del rubro: "Canchas" en
// un complejo, "Salas" en un estudio de ensayo, "Salones" o "Quinchos" por
// bloque, "Propiedades", "Deptos" o "Cocheras" por período. Sin palabras, las
// del modo.
//
// Los links viejos siguen andando: Configuración tenía adentro Reglas,
// Canchas y extras, Precios, Salón, Propiedades y Calendarios, y hoy cada una
// es una sección; y "salon" (un solo salón) hoy es "salones". resolverRuta
// traduce ?vista=configuracion&tab=reglas a vista=reglas y lo marca con
// `corregir`, para que el panel reescriba la URL.
import type { Palabras, TipoAlquiler } from '../datos'

export type Vista = 'reservas' | 'disponibilidad' | 'clientes' | 'eventos' | 'ingresos' | 'unidades' | 'extras' | 'precios' | 'salones' | 'paquetes' | 'propiedades' | 'temporadas' | 'reglas' | 'bloqueos' | 'mensajes' | 'pagos' | 'calendarios' | 'configuracion'
export type TabConfiguracion = 'negocio' | 'horarios' | 'equipo'

export interface SubNav { id: TabConfiguracion; label: string }
export interface SeccionNav { id: Vista; label: string; grupo?: string; subs?: SubNav[] }

const HOY = 'Hoy'
const RESERVAS = 'Reservas'

/** Las palabras de cada modo cuando el panel no pasa las del rubro (son las de TIPOS, repetidas acá para no importar íconos). */
const DE_FABRICA: Record<TipoAlquiler, Pick<Palabras, 'unidades' | 'clientes'>> = {
  cancha: { unidades: 'canchas', clientes: 'clientes' },
  bloque: { unidades: 'salones', clientes: 'eventos' },
  estadia: { unidades: 'propiedades', clientes: 'huéspedes' },
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function seccionesDe(tipo: TipoAlquiler, palabras: Pick<Palabras, 'unidades' | 'clientes'> = DE_FABRICA[tipo]): SeccionNav[] {
  const unidades = capital(palabras.unidades)
  const disponibilidad: SeccionNav = { id: 'disponibilidad', label: 'Qué hay libre', grupo: HOY }
  const ingresos: SeccionNav = { id: 'ingresos', label: 'Ingresos', grupo: HOY }
  const reglas: SeccionNav = { id: 'reglas', label: 'Reglas de reserva', grupo: RESERVAS }
  const mensajes: SeccionNav = { id: 'mensajes', label: 'Recordatorios y mensajes', grupo: RESERVAS }
  const pagos: SeccionNav = { id: 'pagos', label: 'Pagos y señas', grupo: RESERVAS }
  const calendarios: SeccionNav = { id: 'calendarios', label: 'Calendarios (.ics)' }
  // La estadía no tiene horario de apertura (se entra y se sale a la hora de cada propiedad).
  const configuracion: SeccionNav = {
    id: 'configuracion', label: 'Configuración',
    subs: [{ id: 'negocio', label: 'Datos del negocio' }, ...(tipo !== 'estadia' ? [{ id: 'horarios' as const, label: 'Horarios' }] : []), { id: 'equipo', label: 'Equipo' }],
  }
  if (tipo === 'cancha') {
    return [
      { id: 'reservas', label: 'Reservas', grupo: HOY }, disponibilidad, { id: 'clientes', label: capital(palabras.clientes), grupo: HOY }, ingresos,
      { id: 'unidades', label: unidades, grupo: unidades }, { id: 'extras', label: 'Extras', grupo: unidades }, { id: 'precios', label: 'Precios por horario', grupo: unidades },
      reglas, { id: 'bloqueos', label: 'Días bloqueados', grupo: RESERVAS }, mensajes, pagos,
      calendarios, configuracion,
    ]
  }
  if (tipo === 'bloque') {
    return [
      { id: 'reservas', label: 'Calendario', grupo: HOY }, disponibilidad, { id: 'eventos', label: 'Eventos', grupo: HOY }, ingresos,
      { id: 'salones', label: unidades, grupo: unidades }, { id: 'paquetes', label: 'Paquetes', grupo: unidades }, { id: 'extras', label: 'Extras', grupo: unidades },
      reglas, { id: 'bloqueos', label: 'Días bloqueados', grupo: RESERVAS }, mensajes, pagos,
      calendarios, configuracion,
    ]
  }
  return [
    { id: 'reservas', label: 'Calendario', grupo: HOY }, disponibilidad, { id: 'clientes', label: capital(palabras.clientes), grupo: HOY }, ingresos,
    { id: 'propiedades', label: unidades, grupo: unidades }, { id: 'temporadas', label: 'Temporadas y precios', grupo: unidades }, { id: 'bloqueos', label: 'Bloqueos', grupo: unidades },
    reglas, mensajes, pagos,
    calendarios, configuracion,
  ]
}

/** Las pestañas que Configuración tenía adentro y hoy son secciones: el link viejo abre la sección nueva. */
const TABS_VIEJAS: Record<string, Vista> = { reglas: 'reglas', unidades: 'unidades', precios: 'precios', salon: 'salones', propiedades: 'propiedades', calendarios: 'calendarios' }
/** Secciones que cambiaron de nombre: "salon" (cuando había uno solo) hoy es "salones". */
const VISTAS_VIEJAS: Record<string, Vista> = { salon: 'salones' }

export interface Ruta {
  vista: Vista
  /** Solo en Configuración: la sub-sección (la primera si la URL no trae ninguna). */
  tab?: TabConfiguracion
  /** La URL pedía algo que ya no existe (o que no existe en este modo): hay que reescribirla con `vista` y `tab`. */
  corregir: boolean
}

export function resolverRuta(query: { vista?: string | string[]; tab?: string | string[] }, tipo: TipoAlquiler): Ruta {
  const secciones = seccionesDe(tipo)
  const pedida = typeof query.vista === 'string' ? query.vista : ''
  const tab = typeof query.tab === 'string' ? query.tab : ''
  if (pedida === 'configuracion' && Object.hasOwn(TABS_VIEJAS, tab)) {
    const nueva = TABS_VIEJAS[tab]
    return { vista: secciones.some(s => s.id === nueva) ? nueva : 'reservas', corregir: true }
  }
  const vieja = Object.hasOwn(VISTAS_VIEJAS, pedida)
  const vista = vieja ? VISTAS_VIEJAS[pedida] : pedida
  const seccion = secciones.find(s => s.id === vista)
  if (!seccion) return { vista: 'reservas', corregir: pedida !== '' }
  if (!seccion.subs) return { vista: seccion.id, corregir: vieja || tab !== '' }
  const sub = seccion.subs.find(s => s.id === tab)
  return { vista: seccion.id, tab: sub?.id ?? seccion.subs[0].id, corregir: tab !== '' && !sub }
}
