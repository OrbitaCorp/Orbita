// Reservar en el sitio de un negocio que reserva: <slug>.orbita.site/reserva.
// En Alquileres, una estadía; en Gimnasio, un lugar en una clase. En una tienda
// esta página no existe (404): lo decide getServerSidePropsReserva con el rubro
// que trae la config de la tienda.
//
// El de Gimnasio se carga aparte (dynamic): cada sitio baja solo su código.
import dynamic from 'next/dynamic'
import SitioReal from '@/modules/alquileres/storefront/SitioReal'
import { sitioDelNegocio } from '@/lib/reservas/destinoPanel'

const SitioGimnasio = dynamic(() => import('@/modules/gimnasio/storefront/SitioReal'))

export default function Page({ __slug, __industry, __subrubros }: { __slug?: string | null; __industry?: string | null; __subrubros?: string[] | null }) {
  if (!__slug) return null
  if (sitioDelNegocio(__industry, __subrubros) === 'gimnasio') return <SitioGimnasio slug={__slug} pagina="reserva" />
  return <SitioReal slug={__slug} pagina="reserva" />
}

export { getServerSidePropsReserva as getServerSideProps } from '@/lib/storefront/forceSSR'
