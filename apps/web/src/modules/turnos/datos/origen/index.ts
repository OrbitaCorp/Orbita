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
// Por ahora el origen solo LEE. Lo que se edita (dar un turno, pausar un
// servicio, sumar a alguien) sigue en el estado de PanelTurnos y se conecta a
// la API sección por sección (semanas 2 y 3 del plan). Configuración y
// Avanzado leen sus datos adentro de cada pantalla (useRubroDemo,
// useNegocioDemo): se pasan al origen cuando se conectan las reglas y los
// horarios (13/11). El mapa completo, con lo que el backend no cubre, está en
// la entrada "mapa-de-turnos-sobre-el-backend" de Auditoría.
import { createContext, createElement, useCallback, useContext, useEffect, useEffectEvent, useState, type ReactNode } from 'react'
import type { Cliente, Recurso, RubroTurnos } from '@/modules/turnos/datos'
import type { Semana } from '@/modules/turnos/horario'
import type { ServicioBase, TurnoAgenda } from '@/modules/turnos/datos/agenda'
import type { Persona, Rol } from '@/modules/turnos/datos/equipo'
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

export interface OrigenTurnos {
  tipo: 'demo' | 'api'
  /** Lo de cada sección, junto. Si falla, el error trae el mensaje para mostrar. */
  cargar(rubro: RubroTurnos): Promise<DatosPanel>
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
