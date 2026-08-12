import type { NextApiRequest, NextApiResponse } from 'next'
import { callBackend, readRefreshCookie, firstHeader } from '@/lib/auth/bff'

// POST /api/me/sessions/revoke-all
// Proxy de POST /me/sessions/revoke-all — igual que GET /api/me/sessions,
// necesita el refresh token de esta pestaña (cookie httpOnly) para que el
// backend pueda PRESERVAR la sesión actual al cerrar las demás.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })

  const authorization = firstHeader(req.headers['authorization'])
  if (!authorization) return res.status(401).json({ error: 'NO_TOKEN' })

  const refreshToken = readRefreshCookie(req, 'customer')
  const slug = firstHeader(req.headers['x-business-slug'])

  const { status, body } = await callBackend('/me/sessions/revoke-all', {
    method: 'POST',
    authorization,
    slug,
    extraHeaders: refreshToken ? { 'x-refresh-token': refreshToken } : undefined,
  })

  return res.status(status).json(body ?? { error: 'REVOKE_ALL_FAILED' })
}
