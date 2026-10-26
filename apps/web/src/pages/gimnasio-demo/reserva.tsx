// DEMO INTERNA — reservar un lugar en una clase. Ver modules/gimnasio/storefront/Reserva.tsx.
import Head from 'next/head'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { BarraDemo } from '@/modules/gimnasio/demo/BarraDemo'
import { useNegocio } from '@/modules/gimnasio/demo/useNegocio'
import Reserva from '@/modules/gimnasio/storefront/Reserva'

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} }

export default function Page() {
  const router = useRouter()
  const { rubro, negocio, inscripciones, socios, inscribir } = useNegocio()
  return (
    <>
      <Head><title>{`Reservar clase · ${negocio.nombre}`}</title></Head>
      <BarraDemo />
      {/* key: lo que viene por la URL (?clase=, ?fecha=, ?plan=) entra como estado inicial del flujo.
          El socio nuevo (sn…) se guarda junto con la inscripción; el pack lo descuenta el almacén al inscribir. */}
      <Reserva key={`${rubro.key}:${router.asPath}`} negocio={negocio} inscripciones={inscripciones} socios={socios} query={router.query}
        onInscribir={(i, s) => inscribir(rubro.key, i, s.id.startsWith('sn') ? s : undefined)} />
    </>
  )
}
