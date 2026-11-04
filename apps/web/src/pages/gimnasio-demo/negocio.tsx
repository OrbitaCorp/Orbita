// DEMO INTERNA — el sitio público del gimnasio. Ver modules/gimnasio/storefront.
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { BarraDemo } from '@/modules/gimnasio/demo/BarraDemo'
import { useNegocio } from '@/modules/gimnasio/demo/useNegocio'
import Home from '@/modules/gimnasio/storefront/Home'

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} }

export default function Page() {
  const { rubro, negocio, inscripciones } = useNegocio()
  return (
    <>
      <Head><title>{`${negocio.nombre} · Reservá tu clase`}</title></Head>
      <BarraDemo />
      <Home key={rubro.key} negocio={negocio} inscripciones={inscripciones} />
    </>
  )
}
