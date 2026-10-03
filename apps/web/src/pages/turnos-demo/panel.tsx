// DEMO INTERNA — panel del negocio de Turnos. Ver modules/turnos/admin.
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { BarraDemo } from '@/modules/turnos/demo/BarraDemo'
import PanelTurnos from '@/modules/turnos/admin/PanelTurnos'
import { RelojTurnos, semillaReloj } from '@/modules/turnos/reloj'

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: { reloj: semillaReloj() } }

export default function Page({ reloj }: { reloj: number }) {
  return (
    <>
      <Head><title>Panel · Turnos (local)</title></Head>
      <BarraDemo />
      <RelojTurnos semilla={reloj}><PanelTurnos /></RelojTurnos>
    </>
  )
}
