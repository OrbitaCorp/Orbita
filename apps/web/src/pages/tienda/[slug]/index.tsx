// La portada del sitio de un negocio (<slug>.orbita.site). Para casi todos es
// la tienda (Inicio), como siempre. Si el rubro del negocio es Alquileres, es
// su sitio de reservas. El rubro lo resuelve el servidor junto con la config
// de la tienda (lib/storefront/forceSSR.ts → __industry); si no llegó, es la
// tienda.
//
// El sitio de Alquileres se carga aparte (dynamic): la tienda no suma su código.
import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import Inicio from '@/modules/ventas/cliente/inicio/Inicio'
import { sitioDelNegocio } from '@/lib/reservas/destinoPanel'

const SitioAlquileres = dynamic(() => import('@/modules/alquileres/storefront/SitioReal'))

type Props = ComponentProps<typeof Inicio> & { __industry?: string | null; __slug?: string | null }

export default function Page(props: Props) {
  if (sitioDelNegocio(props.__industry) === 'alquileres' && props.__slug) return <SitioAlquileres slug={props.__slug} pagina="inicio" />
  return <Inicio {...props} />
}

export { getServerSidePropsInicio as getServerSideProps } from '@/lib/storefront/forceSSR'
