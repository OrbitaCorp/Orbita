import type { NextApiRequest, NextApiResponse } from 'next'
import { callBackend, origenPermitido } from '@/lib/auth/bff'

// Sesión anónima de la demo pública (panel, o el Invitado de la tienda) (ver lib/demo/modo.ts y
// AuthService.demoSession en la API). A diferencia de login.ts, NO setea
// ninguna cookie: el backend no emite refresh token para esta sesión, y la
// cookie de refresh del panel es compartida en todo el dominio — pisarla
// dejaba sin sesión a un dueño real que entrara a mirar la demo.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  if (!origenPermitido(req)) return res.status(403).json({ error: 'ORIGEN_NO_PERMITIDO' })

  // channel 'customer' = el cliente Invitado de la tienda demo; si no, el panel.
  const channel = (req.body as { channel?: string } | undefined)?.channel === 'customer' ? 'customer' : 'panel'
  const { status, body } = await callBackend('/auth/demo-session', { req, method: 'POST', body: { channel } })
  return res.status(status).json(body ?? { error: 'DEMO_NO_DISPONIBLE' })
}
