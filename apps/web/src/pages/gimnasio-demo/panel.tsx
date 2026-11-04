// DEMO INTERNA — panel del gimnasio. Ver modules/gimnasio/admin.
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { BarraDemo } from '@/modules/gimnasio/demo/BarraDemo'
import Panel from '@/modules/gimnasio/admin/Panel'

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} }

export default function Page() {
  return (
    <>
      <Head><title>Panel · Gimnasio (local)</title></Head>
      <BarraDemo />
      <Panel />
    </>
  )
}
