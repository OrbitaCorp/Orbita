import type { NextApiRequest, NextApiResponse } from 'next'
import { callBackend } from '@/lib/auth/bff'

// GET /api/auth/invitation-info?token=...
// Proxy de GET /auth/invitation-info: los datos públicos de una invitación
// vigente (tienda, rol, nombre del invitado) para que /aceptar-invitacion
// pueda saludar con nombre antes de pedir la contraseña. Va por el BFF como
// todo auth, para no pelearse con CORS bajo subdominios.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })

  const token = typeof req.query.token === 'string' ? req.query.token : ''
  const { status, body } = await callBackend(`/auth/invitation-info?token=${encodeURIComponent(token)}`, {
    method: 'GET',
  })

  return res.status(status).json(body ?? { error: 'INVITATION_INFO_FAILED' })
}
