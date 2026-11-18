// PRUEBA LOCAL — el panel de Alquileres con los datos de la API de reservas, no los de ejemplo.
//
// Es la misma pantalla de /alquileres-demo/panel montada con el origen de la
// API (modules/alquileres/datos/origen/api.ts) y con la sesión del panel de un
// negocio real. Va bajo /panel porque ahí el subdominio usa la sesión del dueño
// y no la de un cliente (lib/tenant.ts, authChannel). Para probarla:
//
//   1. Sembrar los negocios de prueba en dev: cd apps/api; pnpm seed:alquileres-prueba
//   2. Levantar la API y el front en local y entrar como su dueño
//      (dueno@<slug>.invalid, con ALQUILERES_PRUEBA_PASSWORD del .env de apps/api).
//   3. Abrir <slug>.orbita.local:3001/panel/alquileres, con <slug> canchas-prueba,
//      salones-prueba o cabanas-prueba.
//
// El modo sale de los subrubros del negocio (industry "alquileres"). Por ahora
// solo lee: lo que se cambia no llega a la API (el panel lo avisa arriba). En
// producción esta página no existe.
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { RequireAuth } from '@/lib/auth/RequireAuth'
import Panel from '@/modules/alquileres/admin/Panel'
import { OrigenAlquileresProvider } from '@/modules/alquileres/datos/origen'
import { origenApi } from '@/modules/alquileres/datos/origen/api'

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} }

export default function Page() {
  return (
    <RequireAuth type="member">
      <Head><title>Panel · Alquileres (API, local)</title></Head>
      <OrigenAlquileresProvider origen={origenApi}>
        <Panel />
      </OrigenAlquileresProvider>
    </RequireAuth>
  )
}
