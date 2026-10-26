// DEMO INTERNA — "Mis clases" del socio. Ver modules/gimnasio/storefront/MisClases.tsx.
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { BarraDemo } from '@/modules/gimnasio/demo/BarraDemo'
import { useNegocio } from '@/modules/gimnasio/demo/useNegocio'
import MisClases from '@/modules/gimnasio/storefront/MisClases'

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} }

export default function Page() {
  const { rubro, negocio, inscripciones, socios, cancelar, cambiarInscripcion } = useNegocio()
  return (
    <>
      <Head><title>{`Mis clases · ${negocio.nombre}`}</title></Head>
      <BarraDemo />
      <MisClases key={rubro.key} negocio={negocio} inscripciones={inscripciones} socios={socios} onCancelar={id => cancelar(rubro.key, id)} onCheckIn={id => cambiarInscripcion(id, { estado: 'asistio' })} />
    </>
  )
}
