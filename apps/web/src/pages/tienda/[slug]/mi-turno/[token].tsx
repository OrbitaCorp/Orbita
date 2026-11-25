// "Mi turno": el enlace personal de un turno de un negocio de Turnos,
// <slug>.orbita.site/mi-turno/<token>. Es a donde apuntan los emails del turno
// (apps/api/src/reservas/reservas-avisos.service.ts, RUTA_MI_RESERVA). El token
// es la única llave: no hay cuenta ni búsqueda por código. En el sitio de un
// negocio que no es de Turnos, 404.
import MiTurno from '@/modules/turnos/storefront/MiTurno'

export default function Page({ __slug, token }: { __slug?: string | null; token?: string | null }) {
  return __slug && token ? <MiTurno slug={__slug} token={token} /> : null
}

export { getServerSidePropsMiTurno as getServerSideProps } from '@/lib/storefront/forceSSR'
