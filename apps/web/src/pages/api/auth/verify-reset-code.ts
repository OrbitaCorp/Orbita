import type { NextApiRequest, NextApiResponse } from 'next'
import { callBackend } from '@/lib/auth/bff'

// POST /api/auth/verify-reset-code
// Proxy de POST /auth/verify-reset-code. No consume el código — solo lo
// valida antes de que el frontend pida la contraseña nueva.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })

  const { status, body } = await callBackend('/auth/verify-reset-code', {
    method: 'POST',
    body: req.body,
  })

  return res.status(status).json(body ?? {})
}
