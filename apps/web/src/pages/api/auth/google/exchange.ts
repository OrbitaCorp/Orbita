import type { NextApiRequest, NextApiResponse } from 'next'
import { callBackend, setRefreshCookie, channelForUserType } from '@/lib/auth/bff'

// POST /api/auth/google/exchange
// Proxy de POST /auth/google/exchange. Recibe el código de un solo uso que
// devolvió el redirect de /auth/google/callback (el JWT nunca viajó en esa
// URL), lo cambia server-a-server por la sesión real, setea el refresh token
// en cookie httpOnly (mismo patrón que /api/auth/login) y devuelve el resto
// sin el refresh token, que nunca toca JS.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })

  const code = req.body?.code
  if (typeof code !== 'string' || !code) return res.status(400).json({ error: 'MISSING_CODE' })

  const { status, body } = await callBackend('/auth/google/exchange', {
    method: 'POST',
    body: { code },
  })

  if (status >= 400 || !body || typeof body !== 'object') {
    return res.status(status).json(body ?? { error: 'GOOGLE_EXCHANGE_FAILED' })
  }

  const { refreshToken, ...rest } = body as Record<string, unknown>
  if (typeof refreshToken === 'string') setRefreshCookie(res, req, refreshToken, channelForUserType(rest.type))

  return res.status(200).json(rest)
}
