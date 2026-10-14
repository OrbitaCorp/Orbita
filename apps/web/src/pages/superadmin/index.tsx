import { useEffect } from 'react'
import { RequireAuth } from '@/lib/auth/RequireAuth'
import { SuperAdminDashboard } from '@/modules/superadmin/SuperAdminDashboard'
import { leerConexionPendiente } from '@/lib/platform/conexionClaude'

// Panel de plataforma (super admin) — apex orbita.site/superadmin. El
// contenido real vive en modules/superadmin/ (dashboard + detalle de negocio
// en pages/superadmin/negocios/[id].tsx), sobre los endpoints /platform/*.
export default function SuperAdminPage() {
  return (
    <RequireAuth type="platform_admin">
      <RetomarConexionPendiente />
      <SuperAdminDashboard />
    </RequireAuth>
  )
}

// Si la persona venía de conectar Claude y tuvo que iniciar sesión antes, el login la deja acá: se la devuelve a la
// pantalla de autorización con la solicitud que había guardado (ver conectar-claude.tsx).
function RetomarConexionPendiente() {
  useEffect(() => {
    const req = leerConexionPendiente()
    if (req) window.location.replace(`/superadmin/conectar-claude?req=${encodeURIComponent(req)}`)
  }, [])
  return null
}
