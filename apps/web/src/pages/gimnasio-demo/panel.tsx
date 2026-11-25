// DEMO INTERNA — panel del gimnasio. Ver modules/gimnasio/admin.
//
// Con ?origen=api es el mismo panel sobre la API de reservas, con la sesión
// del panel: hay que entrar antes por /login con una cuenta de un negocio que
// tenga Gimnasio configurado (el de prueba de dev: apps/api/scripts/
// gimnasio-de-prueba.ts). Es la forma de probar Gimnasio contra la base de dev
// hasta que los módulos tengan sus rutas de producción. En producción esta
// página da 404, con origen o sin él.
import Head from 'next/head'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { RequireAuth } from '@/lib/auth/RequireAuth'
import { BarraDemo } from '@/modules/gimnasio/demo/BarraDemo'
import Panel from '@/modules/gimnasio/admin/Panel'
import { OrigenGimnasioProvider } from '@/modules/gimnasio/datos/origen'
import { origenApi } from '@/modules/gimnasio/datos/origen/api'

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} }

export default function Page() {
  const conApi = useRouter().query.origen === 'api'
  return (
    <>
      <Head><title>{conApi ? 'Panel · Gimnasio (local, API)' : 'Panel · Gimnasio (local)'}</title></Head>
      <BarraDemo />
      {conApi
        ? <RequireAuth type="member"><OrigenGimnasioProvider origen={origenApi}><Panel /></OrigenGimnasioProvider></RequireAuth>
        : <Panel />}
    </>
  )
}
