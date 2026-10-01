// DEMO INTERNA — Servicios y precios del negocio de turnos. Ver modules/turnos/storefront.
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { BarraDemo, useRubroDemo } from '@/modules/turnos/demo/BarraDemo'
import ServiciosNegocio from '@/modules/turnos/storefront/ServiciosNegocio'
import { temaDe } from '@/modules/turnos/storefront/tema'

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} }

export default function Page() {
  const [rubro] = useRubroDemo()
  return (
    <>
      <Head><title>{`Servicios y precios · ${temaDe(rubro).nombre}`}</title></Head>
      <BarraDemo />
      <ServiciosNegocio key={rubro.key} rubro={rubro} />
    </>
  )
}
