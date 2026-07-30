import type { NextApiRequest, NextApiResponse } from 'next'
import { callBackend } from '@/lib/auth/bff'

// POST /api/auth/reset-password
// Proxy de POST /auth/reset-password. Sin slug: el token ya lleva businessId
// (o es de PLATFORM_ADMIN) resuelto server-side por el backend.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })

  const { status, body } = await callBackend('/auth/reset-password', {
    method: 'POST',
    body: req.body,
  })

  return res.status(status).json(body ?? {})
}
