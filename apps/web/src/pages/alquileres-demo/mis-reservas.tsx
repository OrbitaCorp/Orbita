// DEMO INTERNA — "Mis reservas" del cliente de Alquileres. Ver modules/alquileres/storefront/MisReservas.tsx.
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { BarraDemo } from '@/modules/alquileres/demo/BarraDemo'
import { useNegocio } from '@/modules/alquileres/demo/useNegocio'
import MisReservas from '@/modules/alquileres/storefront/MisReservas'

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} }

export default function Page() {
  const { tipo, negocio, reservas, cambiarReserva } = useNegocio()
  return (
    <>
      <Head><title>{`Mis reservas · ${negocio.nombre}`}</title></Head>
      <BarraDemo />
      <MisReservas key={tipo} negocio={negocio} reservas={reservas} onCancelar={id => cambiarReserva(id, { estado: 'cancelada' })} />
    </>
  )
}
