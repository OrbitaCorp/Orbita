// El panel de un negocio de Turnos: <slug>.orbita.site/panel/turnos.
//
// Es la misma pantalla de /turnos-demo/panel, montada con el origen de la API
// de reservas (modules/turnos/datos/origen/api.ts) y la sesión del dueño. Va
// bajo /panel porque ahí el subdominio usa la sesión del dueño y no la de un
// cliente (lib/tenant.ts, authChannel). Se llega desde /panel, que manda acá a
// los negocios de Turnos (lib/reservas/destinoPanel.ts), igual que Alquileres.
//
// Quién entra: un miembro con sesión de un negocio de Turnos (industry
// "turnos" y su rubro en subrubros, como lo deja el alta). Cualquier otro
// negocio vuelve a /panel, que lo lleva a su panel de siempre. El rubro
// (barbería, psicología…) es el del negocio, no el ?rubro= de la demo.
//
// En local, con el negocio de prueba de dev: cd apps/api; pnpm seed:turnos-prueba,
// y entrar como su dueño en turnos-prueba.orbita.local:3001/panel.
import { useEffect, useMemo } from 'react'
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { useAuth } from '@/hooks/useAuth'
import { RequireAuth } from '@/lib/auth/RequireAuth'
import { rubroDeTurnos } from '@/lib/reservas/destinoPanel'
import { PageLoader } from '@/components/PageLoader'
import PanelTurnos from '@/modules/turnos/admin/PanelTurnos'
import { OrigenTurnosProvider } from '@/modules/turnos/datos/origen'
import { origenApi } from '@/modules/turnos/datos/origen/api'

// Desde el servidor (no estática): así ?vista= y ?tab= llegan en el primer pintado.
export const getServerSideProps: GetServerSideProps = async () => ({ props: {} })

function SoloTurnos() {
  const { user } = useAuth()
  const negocio = user?.type === 'member' ? user.business : null
  const rubro = negocio ? rubroDeTurnos(negocio.industry, negocio.subrubros) : null
  const nombre = negocio?.name ?? ''
  const real = useMemo(() => (rubro ? { rubro, nombre } : null), [rubro, nombre])
  useEffect(() => {
    // Un negocio que no es de Turnos no tiene nada que hacer acá: a su panel.
    if (negocio && !rubro) window.location.replace('/panel')
  }, [negocio, rubro])
  if (!real) return <PageLoader visible message="Entrando al panel…" />
  return (
    <OrigenTurnosProvider origen={origenApi}>
      <PanelTurnos real={real} />
    </OrigenTurnosProvider>
  )
}

export default function Page() {
  return (
    <RequireAuth type="member">
      <Head>
        <title>Panel · Turnos</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <SoloTurnos />
    </RequireAuth>
  )
}
