// DEMO INTERNA — página pública de reservas. Ver modules/turnos/storefront.
// ?estado=vacio muestra el negocio sin servicios publicados.
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { BarraDemo, useRubroSitio } from '@/modules/turnos/demo/BarraDemo'
import Reserva from '@/modules/turnos/storefront/Reserva'

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} }

export default function Page() {
  const rubro = useRubroSitio()
  return (
    <>
      <Head><title>Reservá tu turno (local)</title></Head>
      <BarraDemo />
      {/* key: al cambiar de rubro el flujo arranca de cero */}
      <Reserva key={rubro.key} rubro={rubro} />
    </>
  )
}
