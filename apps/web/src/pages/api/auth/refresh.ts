import type { NextApiRequest, NextApiResponse } from 'next'
import { callBackend, readRefreshCookie, setRefreshCookie, clearRefreshCookie } from '@/lib/auth/bff'
import { slugFromHost } from '@/lib/tenant'

// POST /api/auth/refresh
// Lee el refresh token de la cookie httpOnly del canal pedido (panel o
// customer — ver authChannel() en tenant.ts) y lo rota contra el backend. Es
// también el mecanismo de "handoff" entre subdominios: cuando el dueño
// aterriza en {slug}.orbita.local/panel sin access token en memoria, esta
// ruta usa la cookie de panel (compartida en .orbita.local) para mintear uno
// nuevo — sin tocar la cookie de customer, que puede tener su propia sesión
// viva en otra pestaña.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })

  const channel: unknown = req.body?.channel
  if (channel !== 'panel' && channel !== 'customer') {
    return res.status(400).json({ error: 'INVALID_CHANNEL' })
  }

  const refreshToken = readRefreshCookie(req, channel)
  if (!refreshToken) return res.status(401).json({ error: 'NO_SESSION' })

  // Slug del Host REAL del pedido (no algo que el cliente pueda mandar y
  // mentir) — el backend lo usa para rechazar un refresh si el token
  // guardado es de OTRO negocio (RBT-660: la cookie de refresh es de dominio
  // ancho, `.orbita.site`, así que sin esto cualquier subdominio podía
  // pedir /api/auth/refresh y recibir en el JSON la sesión de quien sea que
  // tuviera la cookie puesta, sin importar de qué negocio fuera).
  const slug = slugFromHost(req.headers.host) ?? undefined

  // `callBackend` puede tirar directamente (fetch failure) si el backend está
  // inalcanzable — típico durante los segundos que dura un deploy de Railway,
  // mientras el contenedor viejo ya no acepta conexiones y el nuevo todavía no
  // terminó de levantar. Eso NO significa que el refresh token sea inválido.
  let status: number;
  let body: unknown;
  try {
    ({ status, body } = await callBackend('/auth/refresh', { method: 'POST', body: { refreshToken }, slug }));
  } catch {
    return res.status(503).json({ error: 'BACKEND_UNAVAILABLE' })
  }

  // Solo el backend puede decir con certeza que el token es inválido/expirado
  // (401 — ver AuthService.refresh()). Cualquier OTRO código (500 de un bug,
  // 502/503 del propio Railway a mitad de un deploy, etc.) es un fallo
  // transitorio: no hay que borrar la cookie por eso, porque el token puede
  // seguir siendo perfectamente válido un segundo después. Antes CUALQUIER
  // error acá mataba la sesión — el usuario tenía que volver a loguearse
  // después de cada deploy, aunque su sesión siguiera vigente.
  if (status === 401) {
    clearRefreshCookie(res, req, channel)
    return res.status(401).json({ error: 'SESSION_EXPIRED' })
  }
  // Token válido pero de OTRO negocio que el del Host actual (RBT-660,
  // ver el chequeo de slug en AuthService.refresh()). A propósito NO se
  // borra la cookie acá: la sesión sigue perfectamente viva en el
  // subdominio al que realmente pertenece, esta llamada puntual es la que
  // no aplica. Tampoco se deja caer al branch de abajo (503) porque ese
  // dispara un reintento automático en el cliente (hacerRefresh()) que acá
  // solo repetiría el mismo rechazo.
  if (status === 403) {
    return res.status(401).json({ error: 'WRONG_TENANT' })
  }
  if (status >= 400 || !body || typeof body !== 'object') {
    return res.status(503).json({ error: 'BACKEND_UNAVAILABLE' })
  }

  const { refreshToken: rotated, ...rest } = body as Record<string, unknown>
  if (typeof rotated === 'string') setRefreshCookie(res, req, rotated, channel)

  return res.status(200).json(rest) // { token }
}
