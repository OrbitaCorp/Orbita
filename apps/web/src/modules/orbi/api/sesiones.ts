// Cliente de las sesiones del Orbi del panel (API: apps/api/src/orbi/sesiones).
// Los tipos son el contrato de SesionesService; si cambia uno, cambia el otro.
import { authedFetch } from '@/lib/auth/authClient'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

export type EstadoDeAprobacion = 'pendiente' | 'aplicando' | 'aplicada' | 'fallida' | 'cancelada' | 'vencida' | 'desconocida'

export type Parte =
  | { tipo: 'pensamiento'; texto: string }
  | { tipo: 'actividad'; id: string; tool: string; etiqueta: string; estado: 'en_curso' | 'ok' | 'error'; resumen?: string; ms?: number; destino?: { label: string; path: string } }
  | { tipo: 'aprobacion'; actionId: string; tool: string; resumen: string; estadoActual?: EstadoDeAprobacion }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'aviso'; codigo: 'detenido' | 'tope_de_vueltas' | 'error'; texto: string }

export interface ResumenDeSesion {
  id: string
  titulo: string | null
  fijada: boolean
  archivada: boolean
  ultimaActividad: string
  pantalla: string | null
  esperandoAprobacion: boolean
}

export interface MensajeDeSesion {
  id: string
  rol: 'user' | 'assistant'
  partes: Parte[]
  creadoEl: string | null
}

export interface ListaDeSesiones {
  fijadas: ResumenDeSesion[]
  sesiones: ResumenDeSesion[]
  siguiente: string | null
}

/** Un error de la API con su mensaje para personas (el filtro global manda `message`). */
export class ErrorDeSesiones extends Error {
  constructor(readonly status: number, mensaje: string) {
    super(mensaje)
  }
}

async function pedir<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const res = await authedFetch(`${API}/orbi/sesiones${ruta}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  if (res.status === 204) return undefined as T
  const cuerpo = await res.json().catch(() => null) as { message?: unknown } | null
  if (!res.ok) {
    const mensaje = typeof cuerpo?.message === 'string' ? cuerpo.message : 'No se pudo cargar. Probá de nuevo.'
    throw new ErrorDeSesiones(res.status, mensaje)
  }
  return cuerpo as T
}

export function rutaDeLista(opciones: { archivadas?: boolean; q?: string; cursor?: string | null } = {}): string {
  const params = new URLSearchParams()
  if (opciones.archivadas) params.set('archivadas', '1')
  if (opciones.q?.trim()) params.set('q', opciones.q.trim())
  if (opciones.cursor) params.set('cursor', opciones.cursor)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const sesionesApi = {
  listar: (opciones: { archivadas?: boolean; q?: string; cursor?: string | null } = {}) =>
    pedir<ListaDeSesiones>(rutaDeLista(opciones)),
  crear: (pantalla?: string) =>
    pedir<ResumenDeSesion>('', { method: 'POST', body: JSON.stringify(pantalla ? { pantalla } : {}) }),
  abrir: (id: string) =>
    pedir<ResumenDeSesion & { mensajes: MensajeDeSesion[] }>(`/${encodeURIComponent(id)}`),
  editar: (id: string, cambios: { titulo?: string; fijada?: boolean; archivada?: boolean }) =>
    pedir<ResumenDeSesion>(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(cambios) }),
  borrar: (id: string) =>
    pedir<void>(`/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}
