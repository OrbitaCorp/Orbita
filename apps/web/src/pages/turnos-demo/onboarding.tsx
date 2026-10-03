// DEMO INTERNA — el alta única de Órbita: un recorrido para los dos módulos
// (Tienda y Turnos). Ver modules/turnos/onboarding/Alta.tsx.
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { BarraDemo } from '@/modules/turnos/demo/BarraDemo'
import Alta from '@/modules/turnos/onboarding/Alta'
import { RelojTurnos, semillaReloj } from '@/modules/turnos/reloj'

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: { reloj: semillaReloj() } }

export default function Page({ reloj }: { reloj: number }) {
  return (
    <>
      <Head><title>Alta · Órbita (local)</title></Head>
      <BarraDemo />
      <RelojTurnos semilla={reloj}><Alta /></RelojTurnos>
    </>
  )
}
