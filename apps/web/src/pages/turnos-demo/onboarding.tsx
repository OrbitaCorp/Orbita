// DEMO INTERNA — el alta única de Órbita (Tienda, Turnos, Alquileres y
// Gimnasio), con Turnos elegido al entrar. Ver modules/onboarding/alta/Alta.tsx.
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { BarraDemo } from '@/modules/turnos/demo/BarraDemo'
import Alta from '@/modules/onboarding/alta/Alta'

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} }

export default function Page() {
  return (
    <>
      <Head><title>Alta · Órbita (local)</title></Head>
      <BarraDemo />
      <Alta modulo="turnos" />
    </>
  )
}
