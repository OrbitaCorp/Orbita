import type { NextApiRequest, NextApiResponse } from 'next'
import { callBackend, origenPermitido } from '@/lib/auth/bff'

// Sesión anónima del panel de la demo pública (ver lib/demo/modo.ts y
// AuthService.demoSession en la API). A diferencia de login.ts, NO setea
// ninguna cookie: el backend no emite refresh token para esta sesión, y la
// cookie de refresh del panel es compartida en todo el dominio — pisarla
// dejaba sin sesión a un dueño real que entrara a mirar la demo.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  if (!origenPermitido(req)) return res.status(403).json({ error: 'ORIGEN_NO_PERMITIDO' })

  const { status, body } = await callBackend('/auth/demo-session', { req, method: 'POST' })
  return res.status(status).json(body ?? { error: 'DEMO_NO_DISPONIBLE' })
}
