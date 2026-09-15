import type { NextApiRequest, NextApiResponse } from 'next'
import { callBackend, firstHeader } from '@/lib/auth/bff'

// GET /api/auth/me
// Proxy de GET /auth/me. El cliente manda el access token (que tiene en memoria)
// en Authorization; acá se forwardea junto con X-Business-Slug para que el
// backend valide el aislamiento (token del negocio A + slug del negocio B → 401).
// Pasa por el BFF para evitar CORS bajo subdominios.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })

  const authorization = firstHeader(req.headers['authorization'])
  if (!authorization) return res.status(401).json({ error: 'NO_TOKEN' })

  const slug = firstHeader(req.headers['x-business-slug'])
  const { status, body } = await callBackend('/auth/me', {
    req,
    method: 'GET',
    authorization,
    slug,
  })

  return res.status(status).json(body ?? { error: 'ME_FAILED' })
}
