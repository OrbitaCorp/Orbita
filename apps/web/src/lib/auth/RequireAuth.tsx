import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { apexUrl, currentSlug, storefrontBase } from '@/lib/tenant'
import { PageLoader } from '@/components/PageLoader'

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
  // Mientras se resuelve la sesión (o se redirige), el loader OFICIAL de
  // Órbita — el mismo de _app. Antes acá había un anillo genérico: al entrar
  // se veía el loader de marca y de golpe lo pisaba un spinner pelado, como
  // si fueran dos apps distintas. Con el mismo componente, la carga es UNA
  // sola pantalla continua hasta que la página está lista.
  return <PageLoader visible />
}
