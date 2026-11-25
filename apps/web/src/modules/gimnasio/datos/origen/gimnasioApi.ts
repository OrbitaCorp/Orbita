// El cliente de la API de Gimnasio (apps/api/src/gimnasio): lo que no es una
// reserva. Los planes, los alumnos con su plan, y anotar en una clase diciendo
// cómo se paga el lugar. Las clases, los lugares y la lista de espera siguen
// siendo del motor compartido (lib/reservasApi).
//
// - `gimnasioPanel`: las rutas del panel (/gimnasio/...), con la sesión del
//   panel (authedFetch), igual que lib/reservasApi.
// - `gimnasioSitio(slug)`: lo que lee el sitio público, sin sesión.
//
// Los errores salen como ReservasApiError con el mensaje de la API, que ya
// viene en castellano y listo para mostrar ("No le quedan clases en el pack…").
// Contrato: apps/api/src/gimnasio/README.md.
import { authedFetch } from '@/lib/auth/authClient'
import { mensajeDeError } from '@/lib/api'
import { ReservasApiError } from '@/lib/reservasApi/cliente'
import type { Cliente, Reserva } from '@/lib/reservasApi/tipos'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

export type TipoPlanApi = 'PRUEBA' | 'SUELTA' | 'PACK' | 'MEMBRESIA'

/** Cómo se paga un lugar: con el plan del alumno, aparte (en el gimnasio, como clase suelta) o con la clase de prueba. */
export type Pago = 'plan' | 'aparte' | 'prueba'

export interface PlanApi {
  id: string
  tipo: TipoPlanApi
  nombre: string
  precio: number
  /** Pack: cuántas clases trae. */
  clases: number | null
  /** Membresía: clases por semana; 0 = libre. */
  porSemana: number | null
  vigenciaDias: number
  /** Se ofrece en el sitio. */
  activo: boolean
}

/** Un plan como se manda al guardar: con `id`, uno que ya existe; sin `id`, uno nuevo. */
export type GuardarPlan = Omit<PlanApi, 'id'> & { id?: string }

/** El plan de un alumno, con lo que usó. */
export interface SuscripcionApi {
  id: string
  planId: string
  tipo: TipoPlanApi
  nombre: string
  precio: number
  clases: number | null
  porSemana: number | null
  /** AAAA-MM-DD, los dos días incluidos. */
  desde: string
  hasta: string
  estado: 'VIGENTE' | 'CANCELADA'
  /** Lugares que tomó con este plan (las reservas canceladas no cuentan). */
  usadas: number
  /** Pack: las clases que le quedan. null si no es un pack. */
  restantes: number | null
}

export interface AlumnoApi {
  id: string
  /** Su ficha de cliente: es el `clienteId` de sus reservas. */
  clienteId: string
  nombre: string
  telefono: string | null
  email: string | null
  nota: string | null
  /** Día de alta, AAAA-MM-DD. */
  alta: string
  /** Ya usó la clase de prueba. */
  probo: boolean
  /** Sus planes que valen hoy o arrancan después, del que vence primero al último. */
  planes: SuscripcionApi[]
  /** El último plan que tuvo, si hoy no le queda ninguno. */
  ultimo: SuscripcionApi | null
}

/** Cómo quedó pago un lugar. `pago: null` es sin definir (pasó de la lista de espera o reservó desde el sitio). */
export interface PagoApi {
  pago: Pago | null
  /** El plan con el que se pagó, como quedó después de este lugar. */
  plan: SuscripcionApi | null
  /** Membresía con tope: cuántas usó esa semana, contando esta. */
  usadasEnLaSemana: number | null
}

export interface LugarPago { reserva: Reserva; pago: PagoApi }

/** Dar de alta: una ficha de cliente que ya existe o los datos de alguien nuevo (nombre y un celular o un email). */
export interface AltaDeAlumno { clienteId?: string; cliente?: Cliente; nota?: string; planId?: string }

/** Anotar a alguien en una clase diciendo cómo se paga. `clave`: un uuid por intento. */
export interface ReservarConPago {
  recursoId: string
  fecha: string
  inicioMinutos: number
  cantidad?: number
  alumnoId?: string
  clienteId?: string
  cliente?: Cliente
  pago: Pago
  clave: string
}

async function leer<T>(res: Response): Promise<T> {
  const esJson = res.headers.get('content-type')?.includes('application/json')
  const body = esJson ? await res.json().catch(() => null) : null
  if (!res.ok) throw new ReservasApiError(res.status, mensajeDeError(res.status, body))
  return body as T
}

const conCuerpo = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })

async function delPanel<T>(path: string, init: RequestInit = {}): Promise<T> {
  return leer<T>(await authedFetch(`${API_BASE}/gimnasio${path}`, init))
}

export const gimnasioPanel = {
  planes: () => delPanel<PlanApi[]>('/planes'),
  /** La lista entera, como queda: lo que no viene se quita. Todo o nada. Devuelve la lista guardada, con los ids nuevos. */
  guardarPlanes: (planes: GuardarPlan[]) => delPanel<PlanApi[]>('/planes', conCuerpo('PUT', { planes })),

  alumnos: () => delPanel<AlumnoApi[]>('/alumnos'),
  /** Si esa persona ya era alumna, devuelve la misma. Con `planId`, arranca con ese plan. */
  alta: (datos: AltaDeAlumno) => delPanel<AlumnoApi>('/alumnos', conCuerpo('POST', datos)),
  cambiarAlumno: (id: string, datos: { nota?: string }) => delPanel<AlumnoApi>(`/alumnos/${id}`, conCuerpo('PATCH', datos)),
  /** Asigna o renueva. Renovar la misma membresía antes de que venza la continúa: no pierde días. */
  asignarPlan: (id: string, planId: string) => delPanel<AlumnoApi>(`/alumnos/${id}/plan`, conCuerpo('POST', { planId })),
  /** Quita un plan asignado por error. Los lugares ya pagados con él siguen reservados. */
  quitarPlan: (id: string, suscripcionId: string) => delPanel<AlumnoApi>(`/alumnos/${id}/planes/${suscripcionId}`, { method: 'DELETE' }),

  /**
   * Anota en una clase diciendo cómo se paga. Con `pago: 'plan'`, 409 con el motivo si no tiene plan, venció, no le
   * quedan clases o ya usó las de esa semana. Si la clase está llena, el 409 del motor ("No queda lugar…").
   */
  reservar: (datos: ReservarConPago) => delPanel<LugarPago>('/reservas', conCuerpo('POST', datos)),
  /** Dice o corrige cómo se paga un lugar ya reservado. Pasarlo al plan descuenta con las mismas reglas. */
  definirPago: (reservaId: string, pago: Pago) => delPanel<LugarPago>(`/reservas/${reservaId}/pago`, conCuerpo('POST', { pago })),
}

export type ClienteGimnasio = typeof gimnasioPanel

/** Una sesión de una clase en un día: cuántos lugares tiene y cuántos quedan. */
export interface SesionApi { recursoId: string; inicioMinutos: number; finMinutos: number; libres: number; cupo: number }

/**
 * La grilla del sitio: las sesiones de todas las clases, día por día, con las reglas del sitio ya aplicadas (no trae
 * la clase que ya no se puede reservar). `cerrado` y `motivo` son el día sin clases que cargó el negocio.
 */
export interface GrillaApi {
  desde: string
  hasta: string
  dias: { fecha: string; cerrado: boolean; motivo: string | null; sesiones: SesionApi[] }[]
}

export const gimnasioSitio = (slug: string) => {
  const base = `${API_BASE}/storefront/${encodeURIComponent(slug)}/gimnasio`
  return {
    /** Los planes que el negocio ofrece en el sitio. */
    planes: async () => leer<Omit<PlanApi, 'activo'>[]>(await fetch(`${base}/planes`)),
    /** Las sesiones de todas las clases entre dos días (hasta 35, los dos incluidos), en un solo pedido. */
    grilla: async (desde: string, hasta: string) => leer<GrillaApi>(await fetch(`${base}/grilla?${new URLSearchParams({ desde, hasta }).toString()}`)),
  }
}
