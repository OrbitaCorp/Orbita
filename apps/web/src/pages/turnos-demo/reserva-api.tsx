// PRUEBA LOCAL — la reserva del sitio de un negocio real de Turnos, con la API
// pública de reservas (modules/turnos/storefront/origenSitio.ts) en lugar de
// los datos de ejemplo. Para probarla:
//
//   1. Sembrar el negocio de prueba en dev: cd apps/api; pnpm seed:turnos-prueba
//   2. Levantar la API y el front en local.
//   3. Abrir localhost:3001/turnos-demo/reserva-api (o ?slug=otro-negocio)
//
// La marca del sitio (nombre, colores, fotos) sigue siendo la de la demo del
// rubro (?rubro=, barbería si no viene): lo que viene de la API es la agenda.
// En producción esta página no existe; el sitio real de un negocio de Turnos
// va con las rutas de producción.
import Head from 'next/head'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { useRubroSitio } from '@/modules/turnos/demo/BarraDemo'
import Reserva from '@/modules/turnos/storefront/Reserva'
import { SitioApiProvider } from '@/modules/turnos/storefront/origenSitio'

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} }

export default function Page() {
  const router = useRouter()
  const slug = typeof router.query.slug === 'string' ? router.query.slug : 'turnos-prueba'
  const rubro = useRubroSitio()
  return (
    <SitioApiProvider slug={slug}>
      <Head><title>Reservá tu turno (API, local)</title></Head>
      <Reserva key={`${slug}:${rubro.key}`} rubro={rubro} />
    </SitioApiProvider>
  )
}
