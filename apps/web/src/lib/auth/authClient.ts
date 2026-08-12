// ─── Cliente de auth (bajo nivel) ───────────────────────────────────────────
//
// Access token EN MEMORIA (nunca localStorage/sessionStorage — RBT-290): vive
// en este módulo mientras dura la pestaña. En un reload se pierde y se recupera
// desde la cookie httpOnly de refresh vía tryRefresh().
//
// Todas las llamadas van al BFF (mismo origen, `/api/auth/*`), no al backend
// directo — así se evita CORS bajo subdominios y el refresh token queda httpOnly.

import { currentSlug, authChannel } from '@/lib/tenant'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

/**
 * URL de arranque del flujo de Google OAuth. Navegación de página completa
 * (NO fetch — el backend responde con un 302 a Google), por eso apunta
 * directo al backend en vez de pasar por el BFF. Sin slug = apex (panel de
 * dueño); con slug = storefront de esa tienda.
 */
export function googleLoginUrl(slug?: string): string {
  const query = slug ? `?slug=${encodeURIComponent(slug)}` : ''
  return `${API_BASE}/auth/google/start${query}`
}

let accessToken: string | null = null

export const tokenStore = {
  get: (): string | null => accessToken,
  set: (t: string | null): void => {
    accessToken = t
  },
}

export class AuthError extends Error {
  status: number
  code?: string
  constructor(status: number, body: { error?: string; message?: string } | null) {
    const msg = Array.isArray(body?.message) ? body?.message.join(', ') : body?.message
    super(msg ?? body?.error ?? `Error ${status}`)
    this.status = status
    this.code = body?.error
  }
}

/** fetch a una ruta del BFF inyectando Authorization (memoria) + X-Business-Slug (host). */
export async function bffFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  // Con FormData el Content-Type lo TIENE que poner el browser: incluye el
  // boundary (`multipart/form-data; boundary=----WebKitFormBoundary...`) que
  // el server necesita para separar las partes. Si lo pisamos con
  // application/json, el server intenta parsear el multipart como JSON y
  // falla ("Unexpected token '-'"), o revienta por tamaño antes de eso —
  // era la causa de que las fotos de producto nunca se subieran.
  const esFormData = init.body instanceof FormData
  if (!esFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const slug = currentSlug()
  if (slug) headers.set('X-Business-Slug', slug)
  return fetch(path, { ...init, headers })
}

// Refresh en vuelo, compartido por todos los llamadores concurrentes.
//
// El refresh token es de UN SOLO USO (el backend lo revoca y emite uno nuevo,
// ver AuthService.refresh). Si dos pedidos de refresh salen a la vez con la
// misma cookie, el primero la consume y el segundo la encuentra revocada →
// 401 → el BFF borra la cookie y mata una sesión perfectamente válida.
//
// Pasaba en CADA recarga del panel: el bootstrap del AuthProvider y la primera
// query de datos disparaban su propio refresh casi simultáneamente. De ahí el
// "Token requerido" tras cada deploy (que es cuando uno recarga), que no se
// arreglaba recargando de nuevo — la cookie ya no existía — sino solo
// cerrando e iniciando sesión otra vez.
let refreshEnVuelo: Promise<boolean> | null = null

/** Intenta recuperar un access token desde la cookie de refresh. */
export function tryRefresh(): Promise<boolean> {
  if (!refreshEnVuelo) {
    refreshEnVuelo = hacerRefresh().finally(() => { refreshEnVuelo = null })
  }
  return refreshEnVuelo
}

async function hacerRefresh(): Promise<boolean> {
  const body = JSON.stringify({ channel: authChannel() })
  const headers = { 'Content-Type': 'application/json' }
  let res = await fetch('/api/auth/refresh', { method: 'POST', headers, body })

  // 503 = el backend estaba momentáneamente inalcanzable (típico durante los
  // pocos segundos de un deploy de Railway) — NO significa que la sesión sea
  // inválida, la cookie sigue intacta (ver pages/api/auth/refresh.ts). Un
  // reintento corto alcanza para que el usuario ni lo note si justo estaba
  // navegando en esa ventana.
  if (res.status === 503) {
    await new Promise((r) => setTimeout(r, 1500))
    res = await fetch('/api/auth/refresh', { method: 'POST', headers, body })
  }

  if (!res.ok) {
    accessToken = null
    return false
  }
  const data = (await res.json().catch(() => null)) as { token?: string } | null
  if (data?.token) {
    accessToken = data.token
    return true
  }
  accessToken = null
  return false
}

/**
 * Interceptor para llamadas autenticadas: inyecta auth y, si el backend
 * responde 401, intenta refrescar UNA vez y reintenta. Si el refresh falla,
 * devuelve la respuesta 401 para que el llamador decida (típicamente logout).
 */
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let res = await bffFetch(path, init)
  if (res.status === 401) {
    const refreshed = await tryRefresh()
    if (refreshed) res = await bffFetch(path, init)
  }
  return res
}
