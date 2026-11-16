// De dónde saca y adónde manda sus datos el panel de Gimnasio: la demo (los
// datos de ejemplo y lo que se cambió en este navegador, /gimnasio-demo) o la
// API de reservas (apps/api/src/reservas, por lib/reservasApi), con la sesión
// del panel. Es el mismo criterio que el panel de Turnos, sin importarlo: cada
// módulo tiene el suyo.
//
// Las pantallas no saben de dónde vienen los datos: Panel.tsx le pide al origen
// el negocio, los socios, las inscripciones, el reloj y las acciones, y se los
// pasa por props como siempre. Lo que cambia es cómo se guarda:
//   - demo: en el almacén del navegador (datos/negocio.ts), al instante;
//   - api: con las rutas de /reservas. Si la API dice que no ("No queda lugar
//     en ese horario."), la acción falla con ese mensaje y el panel lo muestra.
//
// Qué guarda la API hoy (plan de Gimnasio, ciclo 2):
//   clases    la grilla (recursos CLASE), anotar, la lista de espera, liberar
//             un lugar, presente y ausente                tareas del 09 al 12/11
//   bloqueos  los días sin clases                         tarea del 13/11
// El resto (alumnos, planes, equipo, actividades, reglas, mensajes, pagos…) se
// ve con lo que se puede armar desde la API y todavía no guarda: el panel lo
// avisa. Se conecta cuando se decida dónde viven planes, pases y alumnos.
import { createContext, createElement, useContext, type ReactNode } from 'react'
import type { ISO } from '@/lib/reservas/fechas'
import type { Inscripcion, NegocioGym, RubroGym, Socio } from '../index'
import type { Reloj } from '../reloj'
import { origenDemo } from './demo'

/** Las secciones del panel (lo que puede venir en ?vista=). */
export type SeccionGimnasio = 'clases' | 'socios' | 'ingresos' | 'equipo' | 'actividades' | 'planes' | 'reglas' | 'bloqueos' | 'mensajes' | 'pagos' | 'calendarios' | 'configuracion'

/** Lo que pasó al guardar, para el aviso del panel ("El primero de la lista ya tiene su lugar."). */
export interface Resultado { detalle?: string }

/**
 * Lo que el panel puede hacer. Todas devuelven una promesa: en la demo se
 * resuelve en el acto; con la API, cuando la base contestó. Si algo no se
 * pudo, la promesa falla con el mensaje para mostrar.
 */
export interface AccionesGimnasio {
  /** Un cambio del negocio: la grilla (`clases`), los días sin clases (`bloqueos`) o lo de cualquier sección. */
  configurar(cambio: Partial<NegocioGym>): Promise<Resultado>
  /** Anota a alguien en una clase, o en su lista de espera si `estado` es 'espera'. `socio` va si es alguien nuevo. */
  inscribir(i: Inscripcion, socio?: Socio): Promise<Resultado>
  /** Presente ('asistio'), ausente, o darle el lugar a quien espera ('reservada'). */
  cambiarInscripcion(id: string, cambio: Partial<Inscripcion>): Promise<Resultado>
  /** Libera un lugar (si había lista de espera, el primero pasa solo) o saca a alguien de la espera. */
  cancelar(id: string): Promise<Resultado>
  agregarSocio(s: Socio): Promise<Resultado>
  cambiarSocio(id: string, cambio: Partial<Socio>): Promise<Resultado>
}

/** Lo que el origen le da al panel. */
export interface VistaGimnasio {
  tipo: 'demo' | 'api'
  negocio: NegocioGym
  socios: Socio[]
  inscripciones: Inscripcion[]
  reloj: Reloj
  /** Quien mira el panel: el dueño de ejemplo en la demo, la persona logueada con la API. */
  usuario: { nombre: string; rol: string }
  /** false hasta tener los datos de verdad (demo: hasta hidratar; API: hasta la primera carga). */
  listo: boolean
  /**
   * Guardando y volviendo a leer (solo con la API): mientras tanto lo que se ve
   * puede estar viejo (la clase todavía "con lugar"), así que el panel no deja
   * tocar nada hasta que llega lo nuevo.
   */
  ocupado: boolean
  /** El mensaje si no se pudo cargar. */
  error: string | null
  reintentar(): void
  /** Si lo que se cambia en esa sección queda guardado en este origen. */
  guarda(seccion: SeccionGimnasio): boolean
  /** Lo que no es igual en la demo y en la API. */
  puede: {
    /** Pasar de "vino" a "faltó" y al revés: la demo deja; la API no (presente y ausente son estados finales). */
    corregirAsistencia: boolean
  }
  /** Que estén las inscripciones de ese día: la API trae una ventana de semanas y la agranda si se mira otra fecha. */
  verFecha(fecha: ISO): void
  acciones: AccionesGimnasio
}

export interface OrigenGimnasio {
  tipo: 'demo' | 'api'
  /**
   * El hook que arma la vista. El origen no cambia mientras el panel está
   * montado (el proveedor se monta una vez), así el orden de los hooks es
   * siempre el mismo.
   */
  useVista(rubro: RubroGym): VistaGimnasio
}

const Contexto = createContext<OrigenGimnasio>(origenDemo)

/** El panel de un negocio real se monta adentro de este proveedor con `origenApi`. Sin proveedor, es la demo. */
export function OrigenGimnasioProvider({ origen, children }: { origen: OrigenGimnasio; children: ReactNode }) {
  return createElement(Contexto.Provider, { value: origen }, children)
}

/** El negocio, los socios, las inscripciones, el reloj y las acciones del panel, del origen que corresponda. */
export function useGimnasio(rubro: RubroGym): VistaGimnasio {
  return useContext(Contexto).useVista(rubro)
}
