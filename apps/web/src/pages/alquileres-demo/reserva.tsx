// DEMO INTERNA — la reserva pública de Alquileres. Ver modules/alquileres/storefront/Reserva.tsx.
import Head from 'next/head'
import { useRouter } from 'next/router'
import type { GetServerSideProps } from 'next'
import { BarraDemo } from '@/modules/alquileres/demo/BarraDemo'
import { SoloEquipo } from '@/modules/alquileres/demo/SoloEquipo'
import { useNegocio } from '@/modules/alquileres/demo/useNegocio'
import Reserva from '@/modules/alquileres/storefront/Reserva'

// Se sigue sirviendo desde el servidor (no estática): así ?tipo= y ?vista= llegan en el primer pintado.
// Quién la puede ver lo decide SoloEquipo: en producción, solo superadmin.
export const getServerSideProps: GetServerSideProps = async () => ({ props: {} })

function Contenido() {
  const router = useRouter()
  const { tipo, negocio, reservas, reservar, hidratado } = useNegocio()
  return (
    <>
      <Head><title>{`Reservar · ${negocio.nombre}`}</title></Head>
      <BarraDemo />
      {/* key: lo que viene por la URL (?unidad=, ?fecha=…) entra como estado inicial del flujo, y se vuelve a
          armar cuando el navegador lee lo guardado (un horario de la URL pudo haberse reservado en esta demo). */}
      <Reserva key={`${tipo}:${router.asPath}:${hidratado}`} negocio={negocio} reservas={reservas} onReservar={(r, c) => reservar(tipo, r, c)} />
    </>
  )
}

export default function Page() {
  return <SoloEquipo><Contenido /></SoloEquipo>
}
