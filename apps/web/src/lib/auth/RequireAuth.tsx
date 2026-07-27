import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { apexUrl, currentSlug, storefrontBase } from '@/lib/tenant'

// ─── Guard de rutas (RBT-290) ───────────────────────────────────────────────
//
// Envuelve una page y exige un tipo de sesión válido PARA ESTE negocio:
//   - type="member"   → panel del dueño; si falta, redirige al login de dueño
//                       (apex orbita.local/login).
//   - type="customer" → cuenta de cliente; si falta, redirige al login del
//                       storefront con returnTo (RBT-351).
//
// El aislamiento por negocio lo garantiza el backend: /auth/me con el
// X-Business-Slug de este subdominio devuelve 401 si el token es de otro
// negocio, así que un token cruzado nunca resuelve como autenticado acá.
//
// Los redirects usan window.location (navegación dura) a propósito: bajo
// subdominios, la navegación client-side de Next NO re-ejecuta el middleware,
// así que un router.push('/login') resolvería a la página equivocada. Una
// navegación dura sí pasa por el middleware y reescribe correctamente.

export function RequireAuth({
  type,
  children,
}: {
  type: 'member' | 'customer' | 'platform_admin'
  children: ReactNode
}) {
  const { status, user } = useAuth()
  const authorized = status === 'authenticated' && user?.type === type

  useEffect(() => {
    if (status === 'loading' || authorized) return

    if (type === 'customer') {
      // Falta sesión de cliente → login del storefront con returnTo.
      const base = storefrontBase(currentSlug() ?? '')
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search)
      window.location.href = `${base}/login?returnTo=${returnTo}`
    } else {
      // member o platform_admin → login del apex (orbita.site/login).
      window.location.href = apexUrl('/login')
    }
  }, [status, authorized, type])

  if (authorized) return <>{children}</>
  return <AuthGate />
}

// Loader neutro mientras se resuelve la sesión o se redirige.
function AuthGate() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--color-surface)' }}>
      <div
        style={{
          width: 28,
          height: 28,
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
          animation: 'orbita-spin 0.7s linear infinite',
        }}
      />
      <style>{`@keyframes orbita-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
