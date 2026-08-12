// ─── Helpers server-side del BFF de auth (pages/api/auth/*) ─────────────────
//
// Por qué existe un BFF y no llamamos al backend directo desde el cliente:
//   1. httpOnly real: el backend devuelve el refresh token en el body JSON (no
//      setea cookie). Para guardarlo en una cookie httpOnly — inaccesible a JS,
//      la opción más segura (RBT-290) — hace falta que un server la setee. El
//      BFF lo hace acá, sin tocar el backend.
//   2. CORS: bajo subdominios el origen del browser es `tienda1.orbita.local`,
//      que NO está en el allowlist de CORS del backend (solo localhost). Al
//      pasar por el BFF (mismo origen que el frontend) y hablar con el backend
//      server-side, se evita CORS por completo.
//
// El access token NO se guarda acá: viaja en el body de la respuesta y el
// cliente lo mantiene en memoria (ver AuthContext).

import type { NextApiRequest, NextApiResponse } from 'next'

const BACKEND_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'orbita.local'

// Dos cookies en vez de una: antes, loguearse como cliente en una pestaña
// pisaba la ÚNICA cookie de refresh compartida en todo `.orbita.local`, lo
// que mataba (en el próximo refresh) la sesión de dueño abierta en otra
// pestaña del mismo negocio. Separar por canal — panel (member/platform_admin)
// vs customer (storefront) — deja que ambas convivan: cada una vive en su
// propia cookie, ninguna pisa a la otra. El cliente decide el canal según la
// ruta (ver authChannel() en tenant.ts, refleja el passthrough del middleware).
export type AuthChannel = 'panel' | 'customer'

const REFRESH_COOKIE_NAMES: Record<AuthChannel, string> = {
  panel: 'orbita_refresh_panel',
  customer: 'orbita_refresh_customer',
}

/** 'customer' si la sesión resultante es de cliente; 'panel' para member/platform_admin. */
export function channelForUserType(type: unknown): AuthChannel {
  return type === 'customer' ? 'customer' : 'panel'
}

// El refresh token dura hasta 30d (customer) / 7d (member) del lado del
// backend. La cookie usa el máximo: si el token expira antes, el backend
// responde 401 al refrescar y limpiamos la cookie. El server es la autoridad.
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60 // 30 días en segundos

/**
 * Dominio de la cookie. Para compartirla entre el apex (orbita.local) y los
 * subdominios de tienda (tienda1.orbita.local) — necesario para el handoff del
 * login de dueño — se scopea a `.orbita.local`. En localhost puro se omite el
 * Domain (cookie host-only) para que igual funcione sin subdominios.
 */
function cookieDomain(host: string | undefined): string | null {
  const hostname = (host ?? '').split(':')[0].toLowerCase()
  if (hostname === ROOT_DOMAIN || hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    return `.${ROOT_DOMAIN}`
  }
  return null // localhost / 127.0.0.1 → host-only
}

export function readRefreshCookie(req: NextApiRequest, channel: AuthChannel): string | null {
  const raw = req.headers.cookie
  if (!raw) return null
  const name = REFRESH_COOKIE_NAMES[channel]
  for (const part of raw.split(';')) {
    const [cookieName, ...rest] = part.trim().split('=')
    if (cookieName === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

function serializeCookie(name: string, value: string, maxAge: number, host: string | undefined): string {
  const isProd = process.env.NODE_ENV === 'production'
  const domain = cookieDomain(host)
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ]
  if (domain) parts.push(`Domain=${domain}`)
  if (isProd) parts.push('Secure') // en dev (http) Secure impediría setear la cookie
  return parts.join('; ')
}

export function setRefreshCookie(res: NextApiResponse, req: NextApiRequest, value: string, channel: AuthChannel): void {
  res.setHeader('Set-Cookie', serializeCookie(REFRESH_COOKIE_NAMES[channel], value, REFRESH_MAX_AGE, req.headers.host))
}

export function clearRefreshCookie(res: NextApiResponse, req: NextApiRequest, channel: AuthChannel): void {
  res.setHeader('Set-Cookie', serializeCookie(REFRESH_COOKIE_NAMES[channel], '', 0, req.headers.host))
}

type BackendResult = { status: number; body: unknown }

/**
 * Llama a un endpoint del backend server-side (sin CORS). Forwardea el body y,
 * opcionalmente, headers de auth (Authorization / X-Business-Slug).
 */
export async function callBackend(
  path: string,
  init: { method: string; body?: unknown; authorization?: string; slug?: string; extraHeaders?: Record<string, string> },
): Promise<BackendResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...init.extraHeaders }
  if (init.authorization) headers['Authorization'] = init.authorization
  if (init.slug) headers['X-Business-Slug'] = init.slug

  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: init.method,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })

  const isJson = res.headers.get('content-type')?.includes('application/json')
  const body = isJson ? await res.json().catch(() => null) : null
  return { status: res.status, body }
}

export function firstHeader(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}
