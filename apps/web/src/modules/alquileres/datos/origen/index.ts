// De dónde saca sus datos el panel de Alquileres: la demo (datos de ejemplo y
// lo guardado en el navegador, /alquileres-demo) o la API de reservas
// (apps/api/src/reservas, por lib/reservasApi). Tarea del 06/11 del plan de
// Alquileres (super admin → Módulos): "un origen por sección, sin tocar las
// pantallas". Mismo patrón que Turnos (modules/turnos/datos/origen), sin
// importarlo: los módulos no se importan entre sí.
//
// Las pantallas no cambian: siguen recibiendo por props el negocio, las
// reservas y los clientes. Lo que cambia es de dónde los saca Panel.tsx: en
// lugar de useNegocio() (la demo), le pide al origen del contexto su
// useDatos(). El origen por defecto es la demo, así /alquileres-demo queda
// igual; el panel de un negocio real monta
// <OrigenAlquileresProvider origen={origenApi}>.
//
// Las escrituras tienen la misma forma que las del almacén de la demo
// (datos/negocio.ts). En la demo escriben en el navegador; en la API todavía
// no escriben (`soloLectura`): se conectan sección por sección en las semanas
// 2 a 4 del plan. El mapa completo, con lo que el backend no cubre, está en
// docs/superpowers/specs/2026-11-18-alquileres-sobre-el-backend-design.md.
import { createContext, createElement, useContext, type ReactElement, type ReactNode } from 'react'
import type { Cliente, NegocioAlquiler, Reserva, TipoAlquiler } from '../index'
import type { DemoAlquiler, useDemoAlquiler } from '../negocio'
import { origenDemo } from './demo'

/** Lo que escribe el panel: las mismas firmas que el almacén de la demo. */
export type Escrituras = Pick<ReturnType<typeof useDemoAlquiler>, 'configurar' | 'reservar' | 'cambiarReserva' | 'agregarBloqueo' | 'quitarBloqueo' | 'agregarCalendario' | 'quitarCalendario' | 'sincronizarCalendario'>

/** Todo lo que el panel necesita, con el estado de la carga. */
export interface DatosPanelAlquiler extends Escrituras {
  tipo: TipoAlquiler
  negocio: NegocioAlquiler
  reservas: Reserva[]
  clientes: Cliente[]
  /** false mientras llegan los datos (en la demo, antes de leer lo guardado en el navegador). */
  listo: boolean
  /** El mensaje para mostrar si la carga falló. */
  error: string | null
  reintentar: () => void
  /** Solo en la demo: el almacén del navegador (lo usa la campanita para las reservas nuevas). */
  demo?: DemoAlquiler
  /** Sube cada vez que llegan datos nuevos de la API: los formularios se vuelven a montar con lo guardado. La demo no lo usa. */
  version?: number
  /** true si lo que se cambia en el panel todavía no llega a la API. */
  soloLectura: boolean
}

export interface OrigenAlquileres {
  tipo: 'demo' | 'api'
  /** Un hook: el panel lo llama en cada render, siempre del mismo origen. */
  useDatos(): DatosPanelAlquiler
}

const Contexto = createContext<OrigenAlquileres>(origenDemo)

/** El panel de un negocio real va adentro de este proveedor con `origenApi`. */
export function OrigenAlquileresProvider({ origen, children }: { origen: OrigenAlquileres; children: ReactNode }): ReactElement {
  return createElement(Contexto.Provider, { value: origen }, children)
}

export const useOrigenAlquileres = () => useContext(Contexto)
