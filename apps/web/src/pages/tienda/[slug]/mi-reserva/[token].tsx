// "Mi reserva": el enlace personal de una reserva de Alquileres,
// <slug>.orbita.site/mi-reserva/<token>. Es a donde apuntan los emails de la
// reserva (apps/api/src/reservas/reservas-avisos.service.ts, RUTA_MI_RESERVA).
// El token es la única llave: no hay cuenta ni búsqueda por código.
import SitioReal from '@/modules/alquileres/storefront/SitioReal'

export default function Page({ __slug, token }: { __slug?: string | null; token?: string | null }) {
  return __slug && token ? <SitioReal slug={__slug} pagina="mi-reserva" token={token} /> : null
}

export { getServerSidePropsMiReserva as getServerSideProps } from '@/lib/storefront/forceSSR'
