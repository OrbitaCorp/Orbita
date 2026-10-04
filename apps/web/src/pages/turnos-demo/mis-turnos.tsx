// DEMO INTERNA — Mis turnos del negocio de turnos. Ver modules/turnos/storefront.
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { BarraDemo, useRubroDemo } from '@/modules/turnos/demo/BarraDemo'
import MisTurnos from '@/modules/turnos/storefront/MisTurnos'
import { temaDe } from '@/modules/turnos/storefront/tema'

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} }

export default function Page() {
  const [rubro] = useRubroDemo()
  return (
    <>
      <Head><title>{`Mis turnos · ${temaDe(rubro).nombre}`}</title></Head>
      <BarraDemo />
      <MisTurnos key={rubro.key} rubro={rubro} />
    </>
  )
}
