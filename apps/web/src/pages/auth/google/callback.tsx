import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Store, AlertCircle, ArrowRight } from 'lucide-react'
import { tenantUrl, apexUrl } from '@/lib/tenant'
import { OrbitaLogo } from '@/design-system/components/OrbitaLogo'

// Único punto de aterrizaje del flujo de Google OAuth (storefront y apex —
// ver el comentario en google-auth.controller.ts). Lee `code` (éxito) o
// `error` (rechazo) de la URL — nunca un token: el JWT/refresh token viaja
// recién acá, server-a-server, vía POST /api/auth/google/exchange, que setea
// la cookie httpOnly y devuelve a dónde redirigir según el `type` de sesión.
type Status = 'exchanging' | 'error'
type ErrorKind = 'NO_BUSINESS' | 'GOOGLE_AUTH_FAILED'

export default function GoogleCallback() {
  const router = useRouter()
  const [status, setStatus] = useState<Status>('exchanging')
  const [errorKind, setErrorKind] = useState<ErrorKind>('GOOGLE_AUTH_FAILED')

  useEffect(() => {
    if (!router.isReady) return

    const { code, error, returnTo } = router.query
    if (typeof error === 'string') {
      setStatus('error')
      setErrorKind(error === 'NO_BUSINESS' ? 'NO_BUSINESS' : 'GOOGLE_AUTH_FAILED')
      return
    }
    if (typeof code !== 'string') {
      setStatus('error')
      setErrorKind('GOOGLE_AUTH_FAILED')
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
        setErrorKind('GOOGLE_AUTH_FAILED')
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

  if (status === 'exchanging') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-surface)', display: 'grid', placeItems: 'center', padding: 16 }}>
        <p role="status" style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0 }}>Iniciando sesión con Google…</p>
      </div>
    )
  }

  const sinNegocio = errorKind === 'NO_BUSINESS'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-surface)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div style={{
        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
        borderRadius: 16, padding: '36px 32px', width: '100%', maxWidth: 420,
        boxShadow: '0 1px 3px rgba(15,23,42,0.06)', textAlign: 'center',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <OrbitaLogo size={44} />
        </div>

        <div
          aria-hidden="true"
          style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 20px',
            display: 'grid', placeItems: 'center',
            background: sinNegocio ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.10)',
            color: sinNegocio ? 'var(--color-primary)' : 'var(--color-error)',
          }}
        >
          {sinNegocio ? <Store size={26} strokeWidth={1.75} /> : <AlertCircle size={26} strokeWidth={1.75} />}
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 10px' }}>
          {sinNegocio ? 'Todavía no tenés un negocio en Órbita' : 'No pudimos iniciar sesión con Google'}
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--color-muted)', margin: '0 0 28px' }}>
          {sinNegocio
            ? 'Esa cuenta de Google no está asociada a ningún negocio. Creá tu espacio en unos minutos y empezá a vender con tu tienda online.'
            : 'Algo salió mal al conectar con Google. Probá de nuevo en un momento.'}
        </p>

        {sinNegocio && (
          <a href="/onboarding/rubro" className="ds-hover" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', height: 48, borderRadius: 10,
            background: 'var(--color-primary)', color: '#fff',
            fontSize: 14, fontWeight: 700, textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(59,130,246,0.25)',
          }}>
            Crear mi espacio <ArrowRight size={16} strokeWidth={2} />
          </a>
        )}

        <a href="/login" className="ds-hover" style={sinNegocio ? {
          display: 'inline-block', marginTop: 16, padding: '4px 8px', borderRadius: 6,
          fontSize: 13, fontWeight: 500, color: 'var(--color-muted)', textDecoration: 'none',
        } : {
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '100%', height: 48, borderRadius: 10,
          background: 'var(--color-primary)', color: '#fff',
          fontSize: 14, fontWeight: 700, textDecoration: 'none',
          boxShadow: '0 4px 16px rgba(59,130,246,0.25)',
        }}>
          {sinNegocio ? 'Ya tengo un negocio, volver al login' : 'Volver al login'}
        </a>
      </div>
    </div>
  )
}
