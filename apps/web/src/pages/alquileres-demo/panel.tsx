// DEMO INTERNA — panel del negocio de Alquileres. Ver modules/alquileres/admin.
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { BarraDemo } from '@/modules/alquileres/demo/BarraDemo'
import Panel from '@/modules/alquileres/admin/Panel'

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} }

export default function Page() {
  return (
    <>
      <Head><title>Panel · Alquileres (local)</title></Head>
      <BarraDemo />
      <Panel />
    </>
  )
}
