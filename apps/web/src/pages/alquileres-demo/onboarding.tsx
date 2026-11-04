// DEMO INTERNA — el alta única de Órbita con Alquileres elegido al entrar: qué
// alquilás, lo que alquilás, tu negocio, ubicación, tu página, tu cuenta y el
// pago. Al terminar, el negocio queda en esta demo y se sigue en su panel. Ver
// modules/onboarding/alta/Alta.tsx (localhost; en producción da 404).
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { BarraDemo } from '@/modules/alquileres/demo/BarraDemo'
import Alta from '@/modules/onboarding/alta/Alta'

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} }

export default function Page() {
  return (
    <>
      <Head><title>Alta · Alquileres (local)</title></Head>
      <BarraDemo />
      <Alta modulo="alquileres" />
    </>
  )
}
