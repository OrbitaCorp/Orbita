import type { NextApiRequest, NextApiResponse } from 'next'
import { callBackend, setRefreshCookie, firstHeader, channelForUserType } from '@/lib/auth/bff'

// POST /api/auth/register
// Proxy de POST /auth/register (requiere X-Business-Slug). El backend loguea
// directo al registrarse (mismo criterio que login): seteamos la cookie de
// refresh httpOnly acá, igual que hace pages/api/auth/login.ts.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })

  const slug = firstHeader(req.headers['x-business-slug'])
  if (!slug) return res.status(400).json({ error: 'MISSING_SLUG', message: 'Falta la tienda de destino' })

  const { status, body } = await callBackend('/auth/register', {
    method: 'POST',
    body: req.body,
    slug,
  })

  if (status >= 400 || !body || typeof body !== 'object') {
    return res.status(status).json(body ?? { error: 'REGISTER_FAILED' })
  }

  const { refreshToken, ...rest } = body as Record<string, unknown>
  if (typeof refreshToken === 'string') setRefreshCookie(res, req, refreshToken, channelForUserType(rest.type))

  return res.status(status).json(rest)
}
