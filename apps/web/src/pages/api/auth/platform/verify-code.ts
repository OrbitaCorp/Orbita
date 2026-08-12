import type { NextApiRequest, NextApiResponse } from 'next'
import { callBackend, setRefreshCookie } from '@/lib/auth/bff'

// POST /api/auth/platform/verify-code
// Proxy de POST /auth/platform/verify-code — segundo factor del login de
// platform admin (RBT-647). Si el código es correcto, el backend recién ahí
// emite la sesión real: seteamos la cookie de refresh httpOnly, mismo patrón
// que /api/auth/login. Siempre canal 'panel' — un platform_admin nunca es
// customer.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })

  const { status, body } = await callBackend('/auth/platform/verify-code', {
    method: 'POST',
    body: req.body,
  })

  if (status >= 400 || !body || typeof body !== 'object') {
    return res.status(status).json(body ?? { error: 'VERIFY_CODE_FAILED' })
  }

  const { refreshToken, ...rest } = body as Record<string, unknown>
  if (typeof refreshToken === 'string') setRefreshCookie(res, req, refreshToken, 'panel')

  return res.status(200).json(rest)
}
