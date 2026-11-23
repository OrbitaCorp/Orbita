// DEMO INTERNA — el alta única de Órbita con Alquileres elegido al entrar: qué
// alquilás, lo que alquilás, tu negocio, ubicación, tu página, tu cuenta y el
// pago. Al terminar, el negocio queda en esta demo y se sigue en su panel. Ver
// modules/onboarding/alta/Alta.tsx (en producción, solo para superadmin).
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { BarraDemo } from '@/modules/alquileres/demo/BarraDemo'
import { SoloEquipo } from '@/modules/alquileres/demo/SoloEquipo'
import Alta from '@/modules/onboarding/alta/Alta'

// Se sigue sirviendo desde el servidor (no estática): así ?tipo= y ?vista= llegan en el primer pintado.
// Quién la puede ver lo decide SoloEquipo: en producción, solo superadmin.
export const getServerSideProps: GetServerSideProps = async () => ({ props: {} })

function Contenido() {
  return (
    <>
      <Head><title>Alta · Alquileres (demo)</title></Head>
      <BarraDemo />
      <Alta modulo="alquileres" />
    </>
  )
}

export default function Page() {
  return <SoloEquipo><Contenido /></SoloEquipo>
}
