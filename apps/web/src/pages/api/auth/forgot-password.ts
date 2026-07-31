import type { NextApiRequest, NextApiResponse } from 'next'
import { callBackend, firstHeader } from '@/lib/auth/bff'

// POST /api/auth/forgot-password
// Proxy de POST /auth/forgot-password. X-Business-Slug opcional: ausente =
// panel de dueño (apex, busca member global); presente = storefront (busca
// member y luego customer de ESE negocio). El backend nunca revela si el
// email existe (siempre 204), así que este handler tampoco lo distingue.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })

  const slug = firstHeader(req.headers['x-business-slug'])
  const { status, body } = await callBackend('/auth/forgot-password', {
    method: 'POST',
    body: req.body,
    slug,
  })

  return res.status(status).json(body ?? {})
}
