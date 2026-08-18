import type { NextApiRequest, NextApiResponse } from 'next'
import { callBackend, setRefreshCookie } from '@/lib/auth/bff'

// POST /api/auth/accept-invitation
// Proxy de POST /auth/accept-invitation (el link del mail de invitación).
// Mismo criterio que login: el refresh token va a la cookie httpOnly del
// canal panel (compartida en .orbita.site) y al cliente vuelve el resto —
// access token + member + business. Con la cookie puesta, la página redirige
// al subdominio del negocio y el AuthProvider rearma la sesión solo.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })

  const { status, body } = await callBackend('/auth/accept-invitation', {
    method: 'POST',
    body: req.body,
  })

  if (status >= 400 || !body || typeof body !== 'object') {
    return res.status(status).json(body ?? { error: 'ACCEPT_INVITATION_FAILED' })
  }

  const { refreshToken, ...rest } = body as Record<string, unknown>
  if (typeof refreshToken === 'string') setRefreshCookie(res, req, refreshToken, 'panel')

  return res.status(200).json(rest)
}
