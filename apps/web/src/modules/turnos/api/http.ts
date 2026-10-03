// Ayudantes comunes de los clientes de Turnos: armar la query string, el
// cuerpo JSON y las rutas públicas. Los pedidos en sí van por `panelRequest`
// (panel y cuenta del cliente: sesión, refresh y mensajes de error del panel)
// y por `storefrontRequest` (sitio público), los de siempre.
import { tokenStore } from '@/lib/auth/authClient'
import { storefrontRequest } from '@/lib/storefront/api'

type Valor = string | number | boolean | string[] | null | undefined

/** "?a=1&b=x" con lo que tenga valor (las listas van separadas por comas); '' si no queda nada. */
export function qs(params: Record<string, Valor>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v)) { if (v.length) q.set(k, v.join(',')); continue }
    q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

/** Las opciones de un pedido con cuerpo JSON. */
export const conCuerpo = (method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown): RequestInit =>
  body === undefined ? { method } : { method, body: JSON.stringify(body) }

/** Un segmento de URL a salvo (ids, fechas, tokens). */
export const seg = (s: string) => encodeURIComponent(s)

/** Prefijo de los endpoints públicos de turnos de un negocio (storefrontRequest ya agrega /storefront). */
const base = (slug: string) => `/${seg(slug)}/appointments`

/**
 * Pedido a un endpoint público de turnos. Con `conSesion`, manda el token del
 * cliente si hay uno (endpoints @OptionalAuth: reservar, anotarse); el resto
 * va sin auth a propósito.
 */
export function publico<T>(slug: string, path: string, init: RequestInit = {}, conSesion = false): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) }
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  if (conSesion) {
    const token = tokenStore.get()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  return storefrontRequest<T>(`${base(slug)}${path}`, { ...init, headers })
}
