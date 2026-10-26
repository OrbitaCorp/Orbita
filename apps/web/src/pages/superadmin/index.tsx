import Head from 'next/head'
import { RequireAuth } from '@/lib/auth/RequireAuth'
import { SuperAdminDashboard } from '@/modules/superadmin/SuperAdminDashboard'

// Panel de plataforma (super admin) — apex orbita.site/superadmin. El
// contenido real vive en modules/superadmin/ (dashboard + detalle de negocio
// en pages/superadmin/negocios/[id].tsx), sobre los endpoints /platform/*.
export default function SuperAdminPage() {
  return (
    <>
      <Head><title>Superadmin · Órbita</title></Head>
      <RequireAuth type="platform_admin">
        <SuperAdminDashboard />
      </RequireAuth>
    </>
  )
}
