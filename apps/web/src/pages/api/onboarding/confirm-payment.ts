import type { NextApiRequest, NextApiResponse } from 'next'
import { callBackend, setRefreshCookie } from '@/lib/auth/bff'

// BFF para /onboarding/pago-retorno — mismo patrón que
// pages/api/auth/google/exchange.ts. Necesario porque en este punto del
// flujo todavía no existe ninguna sesión (la cuenta recién se crea acá, si
// MP confirma) — el backend devuelve el refreshToken en el body, y solo un
// server puede convertirlo en cookie httpOnly para el origen del frontend.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  const preapprovalId = req.body?.preapprovalId
  if (typeof preapprovalId !== 'string' || !preapprovalId) {
    return res.status(400).json({ error: 'MISSING_PREAPPROVAL_ID' })
  }

  const { status, body } = await callBackend('/subscription/confirm', {
    method: 'POST',
    body: { preapprovalId },
  })
  if (status >= 400 || !body || typeof body !== 'object') {
    return res.status(status).json(body ?? { error: 'CONFIRM_FAILED' })
  }

  const { refreshToken, accessToken, ...rest } = body as Record<string, unknown>
  // El onboarding siempre crea la sesión del dueño recién registrado — canal
  // panel fijo (nunca hay un customer saliendo de este flujo).
  if (typeof refreshToken === 'string') setRefreshCookie(res, req, refreshToken, 'panel')
  // accessToken no viaja al cliente: el panel en el subdominio lo obtiene solo
  // vía /api/auth/refresh con la cookie recién seteada (mismo mecanismo que
  // el login de dueño, ver login.tsx).
  void accessToken
  return res.status(200).json(rest)
}
