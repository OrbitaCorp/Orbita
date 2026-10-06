// Cliente del cupo mensual de Orbi visto desde el panel (API:
// apps/api/src/orbi/cupo/orbi-uso.controller.ts). Al panel solo viajan
// porcentajes enteros: ni créditos, ni tokens, ni USD. Si cambia el
// controller, cambian estos tipos.
import { authedFetch } from '@/lib/auth/authClient'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

/** `GET /orbi/uso`: lo de la persona logueada. */
export interface UsoPropio {
  mes: string
  bloquea: boolean
  negocio: { porcentaje: number }
  propio: { porcentaje: number; topePorcentaje: number | null }
}

export interface MiembroConUso {
  memberId: string
  nombre: string
  /** Sobre su tope si tiene; si no, sobre el cupo entero del negocio. */
  porcentaje: number
  topePorcentaje: number | null
}

export interface AccionDeOrbi {
  fecha: string | null
  miembro: string
  tool: string
  resumen: string
  estado: 'executed' | 'failed'
}

/** `GET /orbi/uso/equipo`: solo dueño y administradores (403 para el resto). */
export interface UsoDelEquipo {
  mes: string
  negocio: { porcentaje: number }
  miembros: MiembroConUso[]
  acciones: AccionDeOrbi[]
}

/** Un error de la API con su mensaje para personas (el filtro global manda `message`). */
export class ErrorDeUso extends Error {
  constructor(readonly status: number, mensaje: string) {
    super(mensaje)
  }
}

async function pedir<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const res = await authedFetch(`${API}/orbi/uso${ruta}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  if (res.status === 204) return undefined as T
  const cuerpo = await res.json().catch(() => null) as { message?: unknown } | null
  if (!res.ok) {
    const mensaje = typeof cuerpo?.message === 'string' ? cuerpo.message : 'No se pudo cargar. Probá de nuevo.'
    throw new ErrorDeUso(res.status, mensaje)
  }
  return cuerpo as T
}

export const usoApi = {
  propio: () => pedir<UsoPropio>(''),
  equipo: () => pedir<UsoDelEquipo>('/equipo'),
  /** Solo el dueño. `null` = sin tope (puede usar todo el cupo del negocio). */
  fijarTope: (memberId: string, topePorcentaje: number | null) =>
    pedir<{ ok: true }>(`/equipo/${encodeURIComponent(memberId)}`, { method: 'PUT', body: JSON.stringify({ topePorcentaje }) }),
}
