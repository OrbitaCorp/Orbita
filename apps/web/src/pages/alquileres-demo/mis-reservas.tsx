// DEMO INTERNA — "Mis reservas" del cliente de Alquileres. Ver modules/alquileres/storefront/MisReservas.tsx.
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { BarraDemo } from '@/modules/alquileres/demo/BarraDemo'
import { SoloEquipo } from '@/modules/alquileres/demo/SoloEquipo'
import { useNegocio } from '@/modules/alquileres/demo/useNegocio'
import MisReservas from '@/modules/alquileres/storefront/MisReservas'

// Se sigue sirviendo desde el servidor (no estática): así ?tipo= y ?vista= llegan en el primer pintado.
// Quién la puede ver lo decide SoloEquipo: en producción, solo superadmin.
export const getServerSideProps: GetServerSideProps = async () => ({ props: {} })

function Contenido() {
  const { tipo, negocio, reservas, cambiarReserva } = useNegocio()
  return (
    <>
      <Head><title>{`Mis reservas · ${negocio.nombre}`}</title></Head>
      <BarraDemo />
      <MisReservas key={tipo} negocio={negocio} reservas={reservas} onCancelar={id => cambiarReserva(id, { estado: 'cancelada' })} />
    </>
  )
}

export default function Page() {
  return <SoloEquipo><Contenido /></SoloEquipo>
}
