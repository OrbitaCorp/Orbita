import type { NextApiRequest, NextApiResponse } from 'next'
import { readRefreshCookie } from '@/lib/auth/bff'

// GET /api/auth/has-session?channel=panel|customer
// Chequeo de sola-presencia: solo mira si existe la cookie httpOnly de ESE
// canal, sin llamar al backend ni rotar nada. A propósito NO usa
// /api/auth/refresh para esto — ese endpoint rota el refresh token en cada
// llamada, y si el dueño tiene el panel abierto en otra pestaña haciendo su
// propio refresh en simultáneo, dos rotaciones sobre la misma cookie podrían
// chocar (mismo bug que ya resolvió AdminLayout.tsx separando cookies por
// canal). No garantiza que el token siga siendo válido del lado del backend
// (puede haber expirado) — solo dice si hay algo para intentar. La página de
// destino (RequireAuth) hace la validación real al aterrizar ahí.
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })

  const channel = req.query.channel
  if (channel !== 'panel' && channel !== 'customer') {
    return res.status(400).json({ error: 'INVALID_CHANNEL' })
  }

  return res.status(200).json({ exists: readRefreshCookie(req, channel) !== null })
}
