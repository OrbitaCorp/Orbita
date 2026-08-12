import type { NextApiRequest, NextApiResponse } from 'next'
import { callBackend, readRefreshCookie, firstHeader } from '@/lib/auth/bff'

// GET /api/me/sessions
// Proxy de GET /me/sessions — pasa por el BFF (a diferencia del resto de
// /me/*, que pega directo al backend) porque MeController necesita el
// refresh token de ESTA pestaña para marcar isCurrent, y ese token vive en
// la cookie httpOnly `orbita_refresh_customer`, inaccesible para el fetch
// directo del cliente. Sin esto, ninguna sesión se marcaba como "actual" y
// el botón "Cerrar" quedaba visible incluso para la sesión en uso.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })

  const authorization = firstHeader(req.headers['authorization'])
  if (!authorization) return res.status(401).json({ error: 'NO_TOKEN' })

  const refreshToken = readRefreshCookie(req, 'customer')
  const slug = firstHeader(req.headers['x-business-slug'])

  const { status, body } = await callBackend('/me/sessions', {
    method: 'GET',
    authorization,
    slug,
    extraHeaders: refreshToken ? { 'x-refresh-token': refreshToken } : undefined,
  })

  return res.status(status).json(body ?? { error: 'SESSIONS_FAILED' })
}
