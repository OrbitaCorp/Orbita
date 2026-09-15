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
//
// Contraseña temporal (hallazgo contrasena-temporal-reseteo, auditoría
// interna 09/09): un member que entró con la temporal que le generó el dueño
// desde Equipo (hasTempPassword en login y /auth/me) no puede usar el panel
// hasta elegir una propia. Toda ruta de member redirige a Mi perfil, que es
// la única pantalla que se deja ver; al cambiarla, MiPerfil vuelve a
// loguear y el user queda sin la marca.

// La sección de Mi perfil del panel: '/admin/ventas/perfil' bajo subdominio,
// '/admin/{negocioId}/ventas/perfil' en la forma legacy (ver
// lib/tenant.ts#adminPath). Se detecta por el final del path, que es igual
// en las dos formas.
const SECCION_PERFIL = '/ventas/perfil'

function debeCambiarContrasena(user: ReturnType<typeof useAuth>['user']): boolean {
  return user?.type === 'member' && user.member.hasTempPassword === true
}

function rutaMiPerfil(): string {
  if (currentSlug()) return `/admin${SECCION_PERFIL}`
  // Forma legacy: el negocioId es el segmento que sigue a /admin/.
  const partes = window.location.pathname.split('/').filter(Boolean)
  const negocioId = partes[0] === 'admin' && partes.length >= 4 ? partes[1] : null
  return negocioId ? `/admin/${negocioId}${SECCION_PERFIL}` : `/admin${SECCION_PERFIL}`
}

export function RequireAuth({
  type,
  children,
}: {
  type: 'member' | 'customer' | 'platform_admin'
  children: ReactNode
}) {
  const { status, user } = useAuth()
  const authorized = status === 'authenticated' && user?.type === type
  // Solo se calcula en el cliente (window): en SSR no hay path y la página
  // igual muestra el loader hasta que la sesión resuelve.
  const enMiPerfil = typeof window !== 'undefined' && window.location.pathname.endsWith(SECCION_PERFIL)
  const forzarCambio = authorized && type === 'member' && debeCambiarContrasena(user) && !enMiPerfil

  useEffect(() => {
    if (forzarCambio) {
      window.location.replace(rutaMiPerfil())
      return
    }
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
  }, [status, authorized, type, forzarCambio])

  if (authorized && !forzarCambio) return <>{children}</>
  // Mientras se resuelve la sesión (o se redirige), el loader OFICIAL de
  // Órbita — el mismo de _app. Antes acá había un anillo genérico: al entrar
  // se veía el loader de marca y de golpe lo pisaba un spinner pelado, como
  // si fueran dos apps distintas. Con el mismo componente, la carga es UNA
  // sola pantalla continua hasta que la página está lista.
  return <PageLoader visible />
}
