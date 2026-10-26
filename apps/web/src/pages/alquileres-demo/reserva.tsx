// DEMO INTERNA — la reserva pública de Alquileres. Ver modules/alquileres/storefront/Reserva.tsx.
import Head from 'next/head'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { BarraDemo } from '@/modules/alquileres/demo/BarraDemo'
import { useNegocio } from '@/modules/alquileres/demo/useNegocio'
import Reserva from '@/modules/alquileres/storefront/Reserva'

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} }

export default function Page() {
  const router = useRouter()
  const { tipo, negocio, reservas, reservar } = useNegocio()
  return (
    <>
      <Head><title>{`Reservar · ${negocio.nombre}`}</title></Head>
      <BarraDemo />
      {/* key: lo que viene por la URL (?unidad=, ?fecha=…) entra como estado inicial del flujo */}
      <Reserva key={`${tipo}:${router.asPath}`} negocio={negocio} reservas={reservas} onReservar={(r, c) => reservar(tipo, r, c)} />
    </>
  )
}
