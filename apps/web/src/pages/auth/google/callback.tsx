import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { tenantUrl, apexUrl } from '@/lib/tenant'

// Único punto de aterrizaje del flujo de Google OAuth (storefront y apex —
// ver el comentario en google-auth.controller.ts). Lee `code` (éxito) o
// `error` (rechazo) de la URL — nunca un token: el JWT/refresh token viaja
// recién acá, server-a-server, vía POST /api/auth/google/exchange, que setea
// la cookie httpOnly y devuelve a dónde redirigir según el `type` de sesión.
type Status = 'exchanging' | 'error'

const ERROR_MESSAGES: Record<string, string> = {
  NO_BUSINESS: 'No tenés un negocio registrado. Hacé el onboarding para crear el tuyo.',
  GOOGLE_AUTH_FAILED: 'No se pudo iniciar sesión con Google. Intentá de nuevo.',
}

export default function GoogleCallback() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('exchanging')
  const [message, setMessage] = useState('Iniciando sesión con Google…')

  useEffect(() => {
    if (!router.isReady) return

    const { code, error } = router.query
    if (typeof error === 'string') {
      setStatus('error')
      setMessage(ERROR_MESSAGES[error] ?? ERROR_MESSAGES.GOOGLE_AUTH_FAILED)
      return
    }
    if (typeof code !== 'string') {
      setStatus('error')
      setMessage(ERROR_MESSAGES.GOOGLE_AUTH_FAILED)
      return
    }

    let cancelled = false
    ;(async () => {
      const res = await fetch('/api/auth/google/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = (await res.json().catch(() => null)) as
        | { type: 'member' | 'customer'; business: { subdomain: string } }
        | { type: 'platform_admin' }
        | null
      if (cancelled) return

      if (!res.ok || !data) {
        setStatus('error')
        setMessage(ERROR_MESSAGES.GOOGLE_AUTH_FAILED)
        return
      }

      // La cookie httpOnly de refresh ya quedó seteada por el BFF. Navegación
      // de página completa: al aterrizar, el AuthProvider de destino la lee
      // (mismo mecanismo que el handoff de login de dueño — ver login.tsx).
      const destination =
        data.type === 'platform_admin'
          ? apexUrl('/superadmin') // super admin → panel de plataforma en el apex
          : data.type === 'member'
            ? tenantUrl(data.business.subdomain, '/panel')
            : tenantUrl(data.business.subdomain, '/')
      window.location.href = destination
    })()

    return () => {
      cancelled = true
    }
  }, [router.isReady, router.query])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-surface)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: '0 0 16px' }}>{message}</p>
        {status === 'error' && (
          <a href="/login" style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
            Volver al login
          </a>
        )}
      </div>
    </div>
  )
}
