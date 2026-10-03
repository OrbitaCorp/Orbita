// DEMO INTERNA — Mis turnos del negocio de turnos. Ver modules/turnos/storefront.
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { BarraDemo, useRubroDemo } from '@/modules/turnos/demo/BarraDemo'
import MisTurnos from '@/modules/turnos/storefront/MisTurnos'
import { temaDe } from '@/modules/turnos/storefront/tema'
import { RelojTurnos, semillaReloj } from '@/modules/turnos/reloj'

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: { reloj: semillaReloj() } }

export default function Page({ reloj }: { reloj: number }) {
  const [rubro] = useRubroDemo()
  return (
    <>
      <Head><title>{`Mis turnos · ${temaDe(rubro).nombre}`}</title></Head>
      <BarraDemo />
      <RelojTurnos semilla={reloj}><MisTurnos key={rubro.key} rubro={rubro} /></RelojTurnos>
    </>
  )
}
