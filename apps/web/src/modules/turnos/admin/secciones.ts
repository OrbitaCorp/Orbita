// Qué secciones tiene el sidebar del panel de Turnos, según el rubro y quién mira (tarea del 06/11
// en Módulos → Turnos). Es la única regla: PanelTurnos arma el menú con esto y le pone a cada
// sección su nombre e ícono; el test (secciones.test.ts) la recorre en los 23 rubros y chequea que
// ninguna sección quede vacía con los datos de ejemplo.
//
// Del rubro, lo único que cambia el menú es el modo de agenda:
//   - por profesional: sin Espacios (cada persona es una columna de la agenda);
//   - por sala o cabina: con Espacios, además de Equipo (quien atiende en cada cabina, sus
//     permisos y cómo cobra, pero sin columna propia en la agenda).
// La seña (Pagos con badge), salud (Pacientes, obra social) y "a domicilio" cambian lo que hay
// adentro de cada sección, no qué secciones hay. Una sección nueva se suma acá, diciendo en qué
// modo y con qué permiso aparece.
import type { Alcance, PermisoId } from '../datos/equipo'
import type { ModoAgenda } from '../datos'

/** Las secciones del panel: lo que puede venir en ?vista=. */
export type Vista =
  | 'resumen' | 'agenda' | 'clientes' | 'servicios' | 'equipo' | 'espacios' | 'ganancias'
  | 'reglas' | 'mensajes' | 'pagos' | 'configuracion' | 'avanzado'

export type GrupoSeccion = 'hoy' | 'negocio' | 'reservas' | 'suelta'

export interface ReglaSeccion {
  id: Vista
  grupo: GrupoSeccion
  /** En qué modos de agenda aparece. */
  modos: ModoAgenda[]
  /** El permiso que la abre: aparece si no es "no". Sin permiso, la ve cualquiera. */
  permiso?: PermisoId
}

const AMBOS: ModoAgenda[] = ['profesional', 'recurso']

/** En orden de menú. */
export const REGLAS_SECCIONES: ReglaSeccion[] = [
  { id: 'resumen', grupo: 'hoy', modos: AMBOS },
  { id: 'agenda', grupo: 'hoy', modos: AMBOS, permiso: 'agenda.ver' },
  { id: 'clientes', grupo: 'negocio', modos: AMBOS, permiso: 'clientes.ver' },
  { id: 'servicios', grupo: 'negocio', modos: AMBOS, permiso: 'servicios.editar' },
  { id: 'equipo', grupo: 'negocio', modos: AMBOS, permiso: 'equipo.editar' },
  { id: 'espacios', grupo: 'negocio', modos: ['recurso'], permiso: 'equipo.editar' },
  { id: 'ganancias', grupo: 'negocio', modos: AMBOS, permiso: 'ganancias.ver' },
  { id: 'reglas', grupo: 'reservas', modos: AMBOS, permiso: 'config.editar' },
  { id: 'mensajes', grupo: 'reservas', modos: AMBOS, permiso: 'config.editar' },
  { id: 'pagos', grupo: 'reservas', modos: AMBOS, permiso: 'config.editar' },
  { id: 'configuracion', grupo: 'suelta', modos: AMBOS, permiso: 'config.editar' },
  { id: 'avanzado', grupo: 'suelta', modos: AMBOS, permiso: 'config.editar' },
]

/** Las secciones que ve quien tiene esos permisos en un negocio con ese modo de agenda, en orden de menú. */
export function seccionesVisibles(modo: ModoAgenda, puede: (id: PermisoId) => Alcance): Vista[] {
  return REGLAS_SECCIONES
    .filter(r => r.modos.includes(modo) && (!r.permiso || puede(r.permiso) !== 'no'))
    .map(r => r.id)
}
