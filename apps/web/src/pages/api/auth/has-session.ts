import type { NextApiRequest, NextApiResponse } from 'next'
import { readRefreshCookie, callBackend } from '@/lib/auth/bff'
import { slugFromHost } from '@/lib/tenant'

// GET /api/auth/has-session?channel=panel|customer
//
// channel=panel: además de mirar si existe la cookie, le pregunta al
// backend (POST /auth/session/peek — sola-lectura, no rota nada) si ESA
// sesión es de ESTE negocio. Necesario porque la cookie de refresh de panel
// vive en dominio ancho (`.orbita.site`, ver bff.ts) — el browser la manda
// a CUALQUIER subdominio de la plataforma. Antes esto era un chequeo de
// sola-presencia ("¿existe la cookie, sea de quien sea?"), así que un
// cliente sin ninguna cuenta de dueño, que en algún momento (en ESE mismo
// navegador) se había logueado como member de OTRO negocio cualquiera, veía
// el atajo "Panel de administrador" en la tienda de un negocio con el que
// no tiene ninguna relación (RBT-660 bis — mismo criterio de aislamiento
// cross-tenant que ya tiene /auth/refresh, acá sin el efecto secundario de
// rotar el token).
//
// channel=customer: sigue siendo sola-presencia — hoy ningún caller lo usa
// para decidir nada sensible (ver StorefrontHeader.tsx/Perfil.tsx, los
// únicos dos callers, ambos piden channel=panel).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })

  const channel = req.query.channel
  if (channel !== 'panel' && channel !== 'customer') {
    return res.status(400).json({ error: 'INVALID_CHANNEL' })
  }

  const refreshToken = readRefreshCookie(req, channel)
  if (!refreshToken) return res.status(200).json({ exists: false })

  if (channel === 'customer') return res.status(200).json({ exists: true })

  // Slug del Host REAL del pedido (no algo que el cliente pueda mandar y
  // mentir) — mismo criterio que /api/auth/refresh.ts.
  const slug = slugFromHost(req.headers.host) ?? undefined

  try {
    const { status, body } = await callBackend('/auth/session/peek', { method: 'POST', body: { refreshToken }, slug })
    const exists = status === 200 && !!(body as { exists?: boolean } | null)?.exists
    return res.status(200).json({ exists })
  } catch {
    // Backend inalcanzable (deploy en curso, etc.) — no es motivo para
    // mostrar el atajo: mejor pecar de no mostrarlo que de mostrarlo mal.
    return res.status(200).json({ exists: false })
  }
}
