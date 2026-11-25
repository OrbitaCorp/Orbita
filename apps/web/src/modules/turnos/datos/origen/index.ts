// De dónde saca sus datos el panel de Turnos: la demo (datos de ejemplo en
// memoria, /turnos-demo) o la API de reservas (apps/api/src/reservas, por
// lib/reservasApi). Tarea del 06/11 del plan de Turnos (super admin → Módulos):
// "un origen por sección, sin tocar las pantallas".
//
// Las pantallas no cambian: siguen recibiendo por props lo que les da
// PanelTurnos. Lo que cambia es de dónde lo saca PanelTurnos: en lugar de
// llamar a los datos de ejemplo, le pide al origen lo de cada sección.
//
//   catálogo  agendas (profesionales o espacios) y servicios   Servicios, Equipo, Espacios
//   clientes  la lista de clientes o pacientes                 Clientes
//   equipo    personas y roles                                 Equipo, Ganancias, "ver como"
//   agenda    la semana del negocio y los turnos de cada día   Resumen, Agenda, Pagos, Mensajes
//
// Cada origen implementa esas cuatro funciones (demo.ts y api.ts) y `cargar`
// las junta. El origen por defecto es la demo, así /turnos-demo sigue igual;
// el panel real de un negocio monta <OrigenTurnosProvider origen={origenApi}>.
//
// Las escrituras se conectan sección por sección (semanas 2 y 3 del plan).
// Servicios ya guarda en el origen (`servicios`, 19/11), y también las agendas
// de Equipo y Espacios (`agendas`): en la demo queda en memoria y en la API va
// a /reservas/servicios y /reservas/recursos. Horarios, feriados y vacaciones
// van a la config y a los bloqueos (`horarios`, solo en la API). Lo demás que
// se edita (dar un turno, los roles, cómo cobra cada uno) sigue en el estado de
// PanelTurnos. Configuración y
// Avanzado leen sus datos adentro de cada pantalla (useRubroDemo,
// useNegocioDemo): se pasan al origen cuando se conectan las reglas y los
// horarios (13/11). El mapa completo, con lo que el backend no cubre, está en
// la entrada "mapa-de-turnos-sobre-el-backend" de Auditoría.
import { createContext, createElement, useCallback, useContext, useEffect, useEffectEvent, useState, type ReactNode } from 'react'
import type { Cliente, EstadoTurno, Recurso, RubroTurnos } from '@/modules/turnos/datos'
import type { Semana } from '@/modules/turnos/horario'
import type { ServicioBase, TurnoAgenda } from '@/modules/turnos/datos/agenda'
import type { Persona, Rol } from '@/modules/turnos/datos/equipo'
import type { DiasCerrados, ReglasApi } from './mapear'
import type { ExtrasReglas } from './datosConfig'
import { origenDemo } from './demo'

/**
 * La agenda: la semana del negocio y los turnos de cada día. Es una función y
 * no una lista porque en la demo los turnos se arman con las agendas como
 * están ahora (si se cambia el horario de alguien, sus turnos de ejemplo se
 * acomodan); en la API son las reservas que ya llegaron, por día.
 */
export interface FuenteAgenda {
  /** El horario del negocio. En la demo cambia apenas se guarda otro en Configuración → Horarios. */
  semana(rubro: RubroTurnos): Semana
  /** Los turnos de un día contado desde hoy (0 = hoy, -1 = ayer). */
  delDia(dia: number, recursos: Recurso[], semana: Semana): TurnoAgenda[]
}

/** Todo lo que el panel necesita al abrir. */
export interface DatosPanel {
  recursos: Recurso[]
  servicios: ServicioBase[]
  clientes: Cliente[]
  personas: Persona[]
  roles: Rol[]
  agenda: FuenteAgenda
}

/**
 * Lo que el panel guarda de los servicios. Pausar es editar con `pausado`.
 * Cada escritura devuelve el servicio como quedó (al crear, con el id que le
 * dio el origen); si falla, el error trae el mensaje para mostrar.
 */
export interface EscrituraServicios {
  /** `orden`: la posición en la lista; uno nuevo va al final. */
  crear(s: ServicioBase, orden: number): Promise<ServicioBase>
  editar(s: ServicioBase): Promise<ServicioBase>
  borrar(id: string): Promise<void>
}

/** Con qué se guarda una agenda: el rubro dice si es de una persona o un espacio; la semana, cuál es el horario del negocio. */
export interface CtxAgenda { rubro: RubroTurnos; semana: Semana; rolId?: string }

/**
 * Lo que el panel guarda de las agendas: las de las personas que atienden
 * (Equipo, rubros por profesional) y los espacios (Espacios, por sala o
 * cabina). Igual que los servicios, cada escritura devuelve la agenda como
 * quedó; al crear, con el id del origen.
 */
export interface EscrituraAgendas {
  crear(r: Recurso, ctx: CtxAgenda & { orden: number }): Promise<Recurso>
  editar(r: Recurso, ctx: CtxAgenda): Promise<Recurso>
  /** La API no borra una agenda con reservas por delante: el error lo dice. */
  borrar(id: string): Promise<void>
}

/** Cómo quedó todo después de guardar el horario semanal. */
export interface SemanaGuardada {
  semana: Semana
  /** Las agendas con el horario nuevo. */
  recursos: Recurso[]
  /** Quienes, con su horario propio, no atienden ningún día del horario nuevo. */
  sinDias: string[]
}

/**
 * El horario del negocio, los feriados y las vacaciones (Configuración →
 * Horarios). La demo no los guarda acá: la semana va al navegador y lo demás
 * queda en la pantalla, por eso solo los usa el origen de la API.
 */
export interface EscrituraHorarios {
  /** Las agendas no se tocan: la API cruza cada horario propio con el del negocio. */
  guardarSemana(semana: Semana, rubro: RubroTurnos): Promise<SemanaGuardada>
  /** Lo guardado de hoy en adelante. */
  diasCerrados(): Promise<DiasCerrados>
  /** Reemplaza solo lo que cambió. `hayTurnos`: quedaron turnos dados adentro (no se cancelan). */
  guardarDiasCerrados(antes: DiasCerrados, despues: DiasCerrados): Promise<{ hayTurnos: boolean }>
}

/** Las reglas de reserva que guarda la config (Reservas → Reglas). Como Horarios, solo en la API. */
export interface EscrituraReglas {
  /** Las de la config y las que viven en su `datos` (las que falten, de fábrica). */
  leer(rubro: RubroTurnos): Promise<{ reglas: ReglasApi; extras: Partial<ExtrasReglas> }>
  /** Una sola escritura de la config; si cambia la grilla, también el paso de cada agenda. */
  guardar(reglas: ReglasApi, extras: ExtrasReglas, rubro: RubroTurnos): Promise<void>
}

/**
 * El equipo (personas, roles y cómo cobra cada uno) mientras no existan las
 * cuentas del equipo: vive en `datos` de la config, solo para el panel.
 */
export interface EscrituraEquipo {
  guardar(personas: Persona[], roles: Rol[]): Promise<void>
}

/** Quién reserva un turno dado desde el panel: alguien de la lista (con su ficha o sus datos) o alguien nuevo. */
export interface ClienteDelTurno { id?: string; nombre: string; telefono?: string; email?: string }

/**
 * Lo que el panel hace con un turno (semana 3 del plan). Cada acción devuelve
 * el turno como quedó en el origen; si el origen dice que no (el horario se
 * ocupó, alguien ya lo cambió), el error trae su mensaje. La demo no lo tiene:
 * ahí los turnos viven en el estado del panel.
 */
export interface EscrituraTurnos {
  crear(t: Omit<TurnoAgenda, 'id'>, cliente: ClienteDelTurno, servicioId?: string): Promise<TurnoAgenda>
  /** Confirmar, atender, ausente o cancelar. */
  estado(id: string, estado: EstadoTurno): Promise<TurnoAgenda>
  /** A otro día (contado desde hoy) y otra hora, y si se pide, a otra agenda. */
  mover(id: string, dia: number, inicio: number, recursoId?: string): Promise<TurnoAgenda>
  /** Registra lo que falta pagar de la seña. */
  sena(id: string): Promise<TurnoAgenda>
}

export interface OrigenTurnos {
  tipo: 'demo' | 'api'
  /** Lo de cada sección, junto. Si falla, el error trae el mensaje para mostrar. */
  cargar(rubro: RubroTurnos): Promise<DatosPanel>
  servicios: EscrituraServicios
  agendas: EscrituraAgendas
  horarios?: EscrituraHorarios
  reglas?: EscrituraReglas
  equipo?: EscrituraEquipo
  turnos?: EscrituraTurnos
}

const Contexto = createContext<OrigenTurnos>(origenDemo)

/** El panel real de un negocio monta el panel adentro de este proveedor con `origenApi`. */
export function OrigenTurnosProvider({ origen, children }: { origen: OrigenTurnos; children: ReactNode }) {
  return createElement(Contexto.Provider, { value: origen }, children)
}

export const useOrigenTurnos = () => useContext(Contexto)

export interface CargaPanel {
  datos: DatosPanel | null
  error: string | null
  reintentar: () => void
}

/**
 * Carga los datos del panel una vez por montaje: el panel se monta de nuevo
 * al cambiar de rubro o de negocio (la key de PanelTurnos), así que no se
 * vuelve a cargar cuando el rubro cambia por adentro (guardar un horario),
 * que pisaría lo que se editó en memoria.
 */
export function useDatosPanel(origen: OrigenTurnos, rubro: RubroTurnos): CargaPanel {
  const [estado, setEstado] = useState<{ datos: DatosPanel | null; error: string | null }>({ datos: null, error: null })
  const [intento, setIntento] = useState(0)
  const cargar = useEffectEvent(() => origen.cargar(rubro))
  useEffect(() => {
    let vivo = true
    cargar().then(
      datos => { if (vivo) setEstado({ datos, error: null }) },
      (e: unknown) => { if (vivo) setEstado({ datos: null, error: e instanceof Error && e.message ? e.message : 'No pudimos traer los datos del panel.' }) },
    )
    return () => { vivo = false }
  }, [origen, intento])
  const reintentar = useCallback(() => { setEstado({ datos: null, error: null }); setIntento(n => n + 1) }, [])
  return { ...estado, reintentar }
}
