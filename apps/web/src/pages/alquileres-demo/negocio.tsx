// DEMO INTERNA — el sitio público del negocio de Alquileres. Ver modules/alquileres/storefront.
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { BarraDemo } from '@/modules/alquileres/demo/BarraDemo'
import { useNegocio } from '@/modules/alquileres/demo/useNegocio'
import Home from '@/modules/alquileres/storefront/Home'

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} }

export default function Page() {
  const { tipo, negocio, reservas } = useNegocio()
  return (
    <>
      <Head><title>{`${negocio.nombre} · Reservá online`}</title></Head>
      <BarraDemo />
      <Home key={tipo} negocio={negocio} reservas={reservas} />
    </>
  )
}
