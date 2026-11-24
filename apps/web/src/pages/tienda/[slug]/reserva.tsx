// Reservar en el sitio de un negocio de Alquileres: <slug>.orbita.site/reserva.
// En un negocio que no es de Alquileres esta página no existe (404): lo decide
// getServerSidePropsAlquileres con el rubro que trae la config de la tienda.
import SitioReal from '@/modules/alquileres/storefront/SitioReal'

export default function Page({ __slug }: { __slug?: string | null }) {
  return __slug ? <SitioReal slug={__slug} pagina="reserva" /> : null
}

export { getServerSidePropsAlquileres as getServerSideProps } from '@/lib/storefront/forceSSR'
