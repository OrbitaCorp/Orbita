import type { NextApiRequest, NextApiResponse } from 'next'
import { callBackend, setRefreshCookie, firstHeader, channelForUserType, origenPermitido } from '@/lib/auth/bff'

// POST /api/auth/login
// Proxy de POST /auth/login. Setea el refresh token en cookie httpOnly y
// devuelve al cliente el access token + datos del usuario (SIN el refresh
// token, que nunca toca JS).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  if (!origenPermitido(req)) return res.status(403).json({ error: 'ORIGEN_NO_PERMITIDO' })

  const slug = firstHeader(req.headers['x-business-slug'])
  const { status, body } = await callBackend('/auth/login', {
    method: 'POST',
    body: req.body,
    slug, // ausente = login de dueño (panel); presente = storefront
  })

  if (status >= 400 || !body || typeof body !== 'object') {
    return res.status(status).json(body ?? { error: 'LOGIN_FAILED' })
  }

  const { refreshToken, ...rest } = body as Record<string, unknown>
  if (typeof refreshToken === 'string') setRefreshCookie(res, req, refreshToken, channelForUserType(rest.type))

  return res.status(200).json(rest)
}
