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

    const { code, error, returnTo } = router.query
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
        | { type: 'platform_admin_mfa_required'; email: string }
        | null
      if (cancelled) return

      if (!res.ok || !data) {
        setStatus('error')
        setMessage(ERROR_MESSAGES.GOOGLE_AUTH_FAILED)
        return
      }

      // Google resolvió a un super admin, pero todavía falta el segundo
      // factor (RBT-647) — no hay cookie seteada todavía. El login del apex
      // ya sabe mostrar el paso de código cuando llega con ?mfaEmail=.
      if (data.type === 'platform_admin_mfa_required') {
        window.location.href = `${apexUrl('/login')}?mfaEmail=${encodeURIComponent(data.email)}`
        return
      }

      // A dónde volver si el login se inició a mitad de un flujo (ej. el
      // checkout, "Iniciá sesión" comprando como invitado) — antes esto se
      // perdía siempre y un customer logueado con Google terminaba en el
      // home del storefront sin importar de dónde vino. El backend ya la
      // validó antes de firmarla en el state (solo relativa, "/tienda/..."),
      // pero se revalida acá también — este query param es visible/editable
      // por cualquiera, no algo que llegue solo a través del roundtrip firmado.
      const returnToSeguro = typeof returnTo === 'string' && returnTo.startsWith('/tienda/') ? returnTo : null

      // La cookie httpOnly de refresh ya quedó seteada por el BFF. Navegación
      // de página completa: al aterrizar, el AuthProvider de destino la lee
      // (mismo mecanismo que el handoff de login de dueño — ver login.tsx).
      const destination =
        data.type === 'platform_admin'
          ? apexUrl('/superadmin') // super admin → panel de plataforma en el apex
          : data.type === 'member'
            ? tenantUrl(data.business.subdomain, '/panel')
            : returnToSeguro
              ? tenantUrl(data.business.subdomain, returnToSeguro)
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
          // ds-hover y no ds-link: el subrayado del estándar no le gana al
          // textDecoration:none inline, el velo sí funciona
          <a href="/login" className="ds-hover" style={{ fontSize: 13, color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none', borderRadius: 6, padding: '2px 4px' }}>
            Volver al login
          </a>
        )}
      </div>
    </div>
  )
}
