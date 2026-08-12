import type { NextApiRequest, NextApiResponse } from 'next'
import { callBackend, firstHeader } from '@/lib/auth/bff'

// DELETE /api/me/sessions/:id
// Proxy de DELETE /me/sessions/:id. No necesita el refresh token (revocar
// una sesión puntual por id no depende de cuál es "la actual"), pero pasa
// por acá igual para mantener el mismo origen que GET /api/me/sessions.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })

  const authorization = firstHeader(req.headers['authorization'])
  if (!authorization) return res.status(401).json({ error: 'NO_TOKEN' })

  const id = firstHeader(req.query.id)
  const slug = firstHeader(req.headers['x-business-slug'])

  const { status, body } = await callBackend(`/me/sessions/${id}`, {
    method: 'DELETE',
    authorization,
    slug,
  })

  return res.status(status).json(body ?? { error: 'REVOKE_SESSION_FAILED' })
}
