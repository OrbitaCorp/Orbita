// DEMO INTERNA — panel del negocio de Alquileres. Ver modules/alquileres/admin.
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { BarraDemo } from '@/modules/alquileres/demo/BarraDemo'
import { SoloEquipo } from '@/modules/alquileres/demo/SoloEquipo'
import Panel from '@/modules/alquileres/admin/Panel'

// Se sigue sirviendo desde el servidor (no estática): así ?tipo= y ?vista= llegan en el primer pintado.
// Quién la puede ver lo decide SoloEquipo: en producción, solo superadmin.
export const getServerSideProps: GetServerSideProps = async () => ({ props: {} })

function Contenido() {
  return (
    <>
      <Head><title>Panel · Alquileres (demo)</title></Head>
      <BarraDemo />
      <Panel />
    </>
  )
}

export default function Page() {
  return <SoloEquipo><Contenido /></SoloEquipo>
}
