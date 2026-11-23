// DEMO INTERNA — el sitio público del negocio de Alquileres. Ver modules/alquileres/storefront.
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { BarraDemo } from '@/modules/alquileres/demo/BarraDemo'
import { SoloEquipo } from '@/modules/alquileres/demo/SoloEquipo'
import { useNegocio } from '@/modules/alquileres/demo/useNegocio'
import Home from '@/modules/alquileres/storefront/Home'

// Se sigue sirviendo desde el servidor (no estática): así ?tipo= y ?vista= llegan en el primer pintado.
// Quién la puede ver lo decide SoloEquipo: en producción, solo superadmin.
export const getServerSideProps: GetServerSideProps = async () => ({ props: {} })

function Contenido() {
  const { tipo, negocio, reservas } = useNegocio()
  return (
    <>
      <Head><title>{`${negocio.nombre} · Reservá online`}</title></Head>
      <BarraDemo />
      <Home key={tipo} negocio={negocio} reservas={reservas} />
    </>
  )
}

export default function Page() {
  return <SoloEquipo><Contenido /></SoloEquipo>
}
