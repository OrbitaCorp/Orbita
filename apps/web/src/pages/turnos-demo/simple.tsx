// DEMO INTERNA — página simple del negocio de turnos: portada, nombre, descripción
// y el botón de reservar. Es la otra forma de sitio (ver modules/turnos/storefront/PaginaSimple).
import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { BarraDemo, useRubroDemo } from '@/modules/turnos/demo/BarraDemo'
import PaginaSimple from '@/modules/turnos/storefront/PaginaSimple'
import { useTema } from '@/modules/turnos/storefront/piezas'

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} }

export default function Page() {
  const [rubro] = useRubroDemo()
  const t = useTema(rubro)
  return (
    <>
      <Head><title>{`${t.nombre} · Reservá tu turno`}</title></Head>
      <BarraDemo />
      <PaginaSimple key={rubro.key} rubro={rubro} />
    </>
  )
}
