// Las secciones del panel de Alquileres, por modo, y cómo se lee la URL. Puro
// (sin React ni íconos: los pone Panel.tsx), así se prueba solo.
//
// Contrato de la URL: ?tipo=<modo>&vista=<sección>&tab=<sub-sección de
// Configuración>. Cada modo tiene su barra lateral: lo de hoy (la agenda, la
// gente o los eventos, los ingresos), lo que se alquila (canchas, el salón o
// las propiedades, con sus extras y precios), las reglas de la reserva
// (reglas, bloqueos, mensajes, pagos), los calendarios externos y la
// configuración del negocio (datos, horarios, equipo).
//
// Los links viejos siguen andando: Configuración tenía adentro Reglas,
// Canchas y extras, Precios, Salón, Propiedades y Calendarios, y hoy cada una
// es una sección. resolverRuta traduce ?vista=configuracion&tab=reglas a
// vista=reglas y lo marca con `corregir`, para que el panel reescriba la URL.
import type { TipoAlquiler } from '../datos'

export type Vista = 'reservas' | 'clientes' | 'eventos' | 'ingresos' | 'unidades' | 'extras' | 'precios' | 'salon' | 'paquetes' | 'propiedades' | 'temporadas' | 'reglas' | 'bloqueos' | 'mensajes' | 'pagos' | 'calendarios' | 'configuracion'
export type TabConfiguracion = 'negocio' | 'horarios' | 'equipo'

export interface SubNav { id: TabConfiguracion; label: string }
export interface SeccionNav { id: Vista; label: string; grupo?: string; subs?: SubNav[] }

const HOY = 'Hoy'
const RESERVAS = 'Reservas'

export function seccionesDe(tipo: TipoAlquiler): SeccionNav[] {
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
      { id: 'reservas', label: 'Reservas', grupo: HOY }, { id: 'clientes', label: 'Clientes', grupo: HOY }, ingresos,
      { id: 'unidades', label: 'Canchas', grupo: 'Canchas' }, { id: 'extras', label: 'Extras', grupo: 'Canchas' }, { id: 'precios', label: 'Precios por horario', grupo: 'Canchas' },
      reglas, { id: 'bloqueos', label: 'Días bloqueados', grupo: RESERVAS }, mensajes, pagos,
      calendarios, configuracion,
    ]
  }
  if (tipo === 'bloque') {
    return [
      { id: 'reservas', label: 'Calendario', grupo: HOY }, { id: 'eventos', label: 'Eventos', grupo: HOY }, ingresos,
      { id: 'salon', label: 'Salón', grupo: 'Salón' }, { id: 'paquetes', label: 'Paquetes', grupo: 'Salón' }, { id: 'extras', label: 'Extras', grupo: 'Salón' },
      reglas, { id: 'bloqueos', label: 'Días bloqueados', grupo: RESERVAS }, mensajes, pagos,
      calendarios, configuracion,
    ]
  }
  return [
    { id: 'reservas', label: 'Calendario', grupo: HOY }, { id: 'clientes', label: 'Huéspedes', grupo: HOY }, ingresos,
    { id: 'propiedades', label: 'Propiedades', grupo: 'Propiedades' }, { id: 'temporadas', label: 'Temporadas y precios', grupo: 'Propiedades' }, { id: 'bloqueos', label: 'Bloqueos', grupo: 'Propiedades' },
    reglas, mensajes, pagos,
    calendarios, configuracion,
  ]
}

/** Las pestañas que Configuración tenía adentro y hoy son secciones: el link viejo abre la sección nueva. */
const TABS_VIEJAS: Record<string, Vista> = { reglas: 'reglas', unidades: 'unidades', precios: 'precios', salon: 'salon', propiedades: 'propiedades', calendarios: 'calendarios' }

export interface Ruta {
  vista: Vista
  /** Solo en Configuración: la sub-sección (la primera si la URL no trae ninguna). */
  tab?: TabConfiguracion
  /** La URL pedía algo que ya no existe (o que no existe en este modo): hay que reescribirla con `vista` y `tab`. */
  corregir: boolean
}

export function resolverRuta(query: { vista?: string | string[]; tab?: string | string[] }, tipo: TipoAlquiler): Ruta {
  const secciones = seccionesDe(tipo)
  const vista = typeof query.vista === 'string' ? query.vista : ''
  const tab = typeof query.tab === 'string' ? query.tab : ''
  if (vista === 'configuracion' && Object.hasOwn(TABS_VIEJAS, tab)) {
    const nueva = TABS_VIEJAS[tab]
    return { vista: secciones.some(s => s.id === nueva) ? nueva : 'reservas', corregir: true }
  }
  const seccion = secciones.find(s => s.id === vista)
  if (!seccion) return { vista: 'reservas', corregir: vista !== '' }
  if (!seccion.subs) return { vista: seccion.id, corregir: tab !== '' }
  const sub = seccion.subs.find(s => s.id === tab)
  return { vista: seccion.id, tab: sub?.id ?? seccion.subs[0].id, corregir: tab !== '' && !sub }
}
