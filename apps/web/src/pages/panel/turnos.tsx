// PRUEBA LOCAL — el panel de Turnos con los datos de la API de reservas, no los de ejemplo.
//
// Es la misma pantalla de /turnos-demo/panel montada con el origen de la API
// (modules/turnos/datos/origen/api.ts) y con la sesión del panel de un negocio
// real. Va bajo /panel porque ahí el subdominio usa la sesión del dueño y no la
// de un cliente (lib/tenant.ts, authChannel). Para probarla:
//
//   1. Sembrar el negocio de prueba en dev: cd apps/api; pnpm seed:turnos-prueba
//   2. Levantar la API y el front en local y entrar como su dueño.
//   3. Abrir turnos-prueba.orbita.local:3001/panel/turnos
//
// El rubro sale de ?rubro= como en la demo (barbería si no viene), no del negocio:
// leer `subrubros` del negocio es parte de las rutas de producción de Turnos.
// Las escrituras siguen locales (se conectan sección por sección) y en
// producción esta página no existe.
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { RequireAuth } from '@/lib/auth/RequireAuth'
import PanelTurnos from '@/modules/turnos/admin/PanelTurnos'
import { OrigenTurnosProvider } from '@/modules/turnos/datos/origen'
import { origenApi } from '@/modules/turnos/datos/origen/api'

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} }

export default function Page() {
  return (
    <RequireAuth type="member">
      <Head><title>Panel · Turnos (API, local)</title></Head>
      <OrigenTurnosProvider origen={origenApi}>
        <PanelTurnos />
      </OrigenTurnosProvider>
    </RequireAuth>
  )
}
