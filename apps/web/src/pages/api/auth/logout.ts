import type { NextApiRequest, NextApiResponse } from 'next'
import { callBackend, readRefreshCookie, clearRefreshCookie } from '@/lib/auth/bff'

// POST /api/auth/logout
// Revoca el refresh token en el backend y limpia la cookie httpOnly del canal
// indicado (panel o customer). Solo toca la cookie de ESE canal — cerrar
// sesión de cliente en una pestaña no puede afectar la sesión de dueño (u
// otra de cliente) que viva en la otra cookie.
// Idempotente: si no hay cookie, igual responde 200.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })

  const channel: unknown = req.body?.channel
  if (channel !== 'panel' && channel !== 'customer') {
    return res.status(400).json({ error: 'INVALID_CHANNEL' })
  }

  const refreshToken = readRefreshCookie(req, channel)
  if (refreshToken) {
    await callBackend('/auth/logout', { method: 'POST', body: { refreshToken } })
  }

  clearRefreshCookie(res, req, channel)
  return res.status(200).json({ ok: true })
}
