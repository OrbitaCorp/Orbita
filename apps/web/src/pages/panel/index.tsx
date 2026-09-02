import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { RequireAuth } from '@/lib/auth/RequireAuth'
import { PageLoader } from '@/components/PageLoader'

// Entrada del panel del dueño en el subdominio de la tienda:
// {slug}.orbita.local/panel
//
// SOLO protege el acceso (RBT-290): exige sesión de tipo member para ESTE
// negocio. No reconstruye el panel — el panel real vive en /admin/[moduloPadre]/[seccion]
// (hoy mock). Desde acá se entra a ese shell existente.
//
// Antes esto mostraba una tarjeta de debug ("Sesión verificada contra el
// backend...", permisos, modo) con un botón "Entrar al panel" — un paso
// manual de más en CADA login, que además exponía info interna que no le
// sirve a nadie del lado del negocio. Ahora RequireAuth ya validó la sesión,
// así que se entra derecho: un instante de loader (mismo componente que ya
// se usa para el salto a Mercado Pago) en vez de la tarjeta.
export default function PanelPage() {
  return (
    <RequireAuth type="member">
      <PanelHome />
    </RequireAuth>
  )
}

function PanelHome() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user || user.type !== 'member') return // RequireAuth ya garantiza esto
    // Entra al shell de admin existente (mock). El negocio ya está
    // identificado por el subdominio actual, así que la URL no lo repite
    // (ver lib/tenant.ts#adminPath). La query viaja entera: el onboarding
    // llega con ?tutorial=checklist y el dashboard tiene que recibirla.
    window.location.href = `/admin/ventas/dashboard${window.location.search}`
  }, [user])

  return <PageLoader visible message="Entrando al panel…" />
}
