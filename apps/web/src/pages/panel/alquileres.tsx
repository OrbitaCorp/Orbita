// El panel de un negocio de Alquileres: <slug>.orbita.site/panel/alquileres.
//
// Es la misma pantalla de /alquileres-demo/panel, montada con el origen de la
// API de reservas (modules/alquileres/datos/origen/api.ts) y la sesión del
// dueño. Va bajo /panel porque ahí el subdominio usa la sesión del dueño y no
// la de un cliente (lib/tenant.ts, authChannel). Se llega desde /panel, que
// manda acá a los negocios de Alquileres (lib/reservas/destinoPanel.ts).
//
// Quién entra: un miembro con sesión, de un negocio cuyo rubro principal es
// "alquileres". Cualquier otro negocio vuelve a /panel, que lo lleva a su panel
// de siempre. Los negocios de Alquileres se crean, por ahora, desde Superadmin
// → Módulos → Alquileres (el alta pública los tiene en "Próximamente").
//
// En local, con los negocios de prueba de dev: cd apps/api; pnpm seed:alquileres-prueba,
// y entrar como dueno@<slug>.invalid (ALQUILERES_PRUEBA_PASSWORD del .env de apps/api).
import { useEffect, useState } from 'react'
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { useAuth } from '@/hooks/useAuth'
import { RequireAuth } from '@/lib/auth/RequireAuth'
import { esDeAlquileres } from '@/lib/reservas/destinoPanel'
import { PageLoader } from '@/components/PageLoader'
import Panel from '@/modules/alquileres/admin/Panel'
import { usarHoyReal } from '@/modules/alquileres/datos'
import { OrigenAlquileresProvider } from '@/modules/alquileres/datos/origen'
import { origenApi } from '@/modules/alquileres/datos/origen/api'

// Desde el servidor (no estática): así ?vista= y ?tab= llegan en el primer pintado.
export const getServerSideProps: GetServerSideProps = async () => ({ props: {} })

/** El día y los minutos de ahora en Argentina (UTC−3), como los usa el panel. */
function ahoraEnArgentina(): [string, number] {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return [d.toISOString().slice(0, 10), d.getUTCHours() * 60 + d.getUTCMinutes()]
}

function SoloAlquileres() {
  const { user } = useAuth()
  const corresponde = user?.type === 'member' && esDeAlquileres(user.business.industry)
  // El panel real usa el día de verdad, no el día fijo de la demo. Una sola vez y solo en el
  // navegador (este componente no se dibuja en el servidor: RequireAuth muestra la carga).
  const [hoyListo] = useState(() => {
    if (typeof window === 'undefined') return false
    usarHoyReal(...ahoraEnArgentina())
    return true
  })
  useEffect(() => {
    // Un negocio que no es de Alquileres no tiene nada que hacer acá: a su panel.
    if (user?.type === 'member' && !corresponde) window.location.replace('/admin/ventas/dashboard')
  }, [user, corresponde])
  if (!corresponde || !hoyListo) return <PageLoader visible message="Entrando al panel…" />
  return (
    <OrigenAlquileresProvider origen={origenApi}>
      <Panel />
    </OrigenAlquileresProvider>
  )
}

export default function Page() {
  return (
    <RequireAuth type="member">
      <Head>
        <title>Panel · Alquileres</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <SoloAlquileres />
    </RequireAuth>
  )
}
