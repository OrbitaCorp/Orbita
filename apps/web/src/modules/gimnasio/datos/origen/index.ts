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
//   socios    los alumnos y el plan de cada uno           tarea del 17/11
//   planes    planes y precios                            tarea del 18/11
//   y con qué se paga cada lugar (el pack se descuenta)   tarea del 19/11
// Las tres últimas van por la API propia de Gimnasio (gimnasioApi.ts), al lado
// del motor de reservas. El resto (equipo, actividades, reglas, mensajes,
// pagos…) se ve con lo que se puede armar desde la API y todavía no guarda:
// el panel lo avisa.
import { createContext, createElement, useContext, type ReactNode } from 'react'
import type { ISO } from '@/lib/reservas/fechas'
import type { Inscripcion, NegocioGym, Pago, RubroGym, Socio } from '../index'
import type { Reloj } from '../reloj'
import { origenDemo } from './demo'

/**
 * Hasta dónde se deja mirar desde hoy, en días, para cada lado. Más lejos no hay nada reservado: el panel no lo muestra
 * y el origen de la API no lo pide (un ?dia= mal escrito no dispara cientos de pedidos).
 */
export const LIMITE_DIAS = 366

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
  /**
   * Un cambio del negocio: la grilla (`clases`), los días sin clases (`bloqueos`) o lo de cualquier sección. Junto con
   * `clases` pueden venir `actividades`, `profes` y `salas`: lo que se cargó ahí mismo, al armar una clase.
   */
  configurar(cambio: Partial<NegocioGym>): Promise<Resultado>
  /**
   * Anota a alguien en una clase, o en su lista de espera si `estado` es 'espera'. `socio` va si es alguien nuevo.
   * `i.pago` dice cómo se paga el lugar: con la API, 'plan' descuenta la clase del pack (y si no le queda, falla con
   * el motivo); sin `pago`, se cobra aparte.
   */
  inscribir(i: Inscripcion, socio?: Socio): Promise<Resultado>
  /** Presente ('asistio'), ausente, o darle el lugar a quien espera ('reservada'). */
  cambiarInscripcion(id: string, cambio: Partial<Inscripcion>): Promise<Resultado>
  /** Libera un lugar (si había lista de espera, el primero pasa solo) o saca a alguien de la espera. */
  cancelar(id: string): Promise<Resultado>
  /** Dice (o corrige) cómo se paga un lugar que ya está reservado. Pasarlo al plan descuenta la clase. */
  definirPago(inscripcionId: string, pago: Pago): Promise<Resultado>
  /** Da de alta a alguien; si trae `planId`, arranca con ese plan. */
  agregarSocio(s: Socio): Promise<Resultado>
  /** Le asigna o le renueva un plan. El detalle del resultado dice hasta cuándo vale. */
  asignarPlan(socioId: string, planId: string): Promise<Resultado>
  /**
   * Le quita un plan asignado por error. `planDeSocioId` dice cuál (con la API puede tener más de uno); sin eso, el
   * que tiene hoy. Los lugares que ya reservó con ese plan siguen reservados.
   */
  quitarPlan(socioId: string, planDeSocioId?: string): Promise<Resultado>
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
  /**
   * Solo con la API: la última lectura falló (se cortó la conexión, la API no contestó) y lo que se ve puede no ser lo
   * que hay guardado. El panel lo avisa arriba, con un botón para actualizar; mientras tanto no da nada por hecho.
   */
  desactualizado: boolean
  /** Vuelve a leer todo. */
  actualizar(): void
  /** Si lo que se cambia en esa sección queda guardado en este origen. */
  guarda(seccion: SeccionGimnasio): boolean
  /** Lo que no es igual en la demo y en la API. */
  puede: Capacidades
  /**
   * Que estén las inscripciones de ese día: la API trae una ventana de semanas y la agranda si se mira otra fecha
   * (hasta un año para cada lado; más lejos no hay nada que mirar y no se pide).
   */
  verFecha(fecha: ISO): void
  /**
   * Hasta qué día (incluido) están leídas las inscripciones; null si están todas (la demo). De lo que cae más lejos
   * todavía no se sabe nada: las reservas adentro de un día sin clases de más adelante no se muestran como cero.
   */
  leidoHasta: ISO | null
  acciones: AccionesGimnasio
}

/** Lo que cambia entre la demo y la API, para que las pantallas digan y ofrezcan lo que de verdad pasa. */
export interface Capacidades {
  /** Pasar de "vino" a "faltó" y al revés: la demo deja; la API no (presente y ausente son estados finales). */
  corregirAsistencia: boolean
  /**
   * La actividad, el profe y la sala se pueden escribir al cargar una clase. Con la API es la única forma de sumarlos:
   * todavía no hay un catálogo aparte (salen de las clases). En la demo se cargan en sus secciones.
   */
  catalogoEnLaClase: boolean
  /** Al subirle el cupo a una clase, quienes esperaban pasan solos. La demo sí; con la API se les da el lugar desde la clase. */
  esperaPasaAlSubirCupo: boolean
  /** Liberar un lugar cancela una reserva de verdad y le avisa a la persona: no tiene vuelta atrás. */
  liberarEsDefinitivo: boolean
  /**
   * Al anotar a alguien se elige cómo paga el lugar (con su plan, aparte o con la clase de prueba) y se puede cambiar
   * después, desde la clase. Siempre, salvo con una API que todavía no tiene los planes de Gimnasio.
   */
  eligePago: boolean
  /**
   * Un lugar puede nacer sin definir cómo se paga: el de quien pasó de la lista de espera o reservó desde el sitio.
   * Con la API (el plan se usa desde el panel); en la demo quien pasa de la espera usa el plan con el que se anotó.
   */
  pagoSinDefinir: boolean
  /** El aviso de vencimiento por WhatsApp desde la ficha: la demo lo simula; con la API todavía no existe. */
  avisoDeVencimiento: boolean
  /**
   * Renovar antes de que venza continúa el plan (arranca cuando termina el que tiene) y un pack nuevo convive con el
   * anterior: lo resuelve la API. En la demo, el plan nuevo arranca hoy y pisa al que había.
   */
  renovarContinua: boolean
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
