// La portada del sitio de un negocio (<slug>.orbita.site). Para casi todos es
// la tienda (Inicio), como siempre. Si el rubro del negocio es Alquileres o
// Gimnasio, es su sitio de reservas. El rubro lo resuelve el servidor junto con
// la config de la tienda (lib/storefront/forceSSR.ts → __industry y
// __subrubros); si no llegó, es la tienda.
//
// Los sitios de reservas se cargan aparte (dynamic): la tienda no suma su código.
import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import Inicio from '@/modules/ventas/cliente/inicio/Inicio'
import { sitioDelNegocio } from '@/lib/reservas/destinoPanel'

const SitioAlquileres = dynamic(() => import('@/modules/alquileres/storefront/SitioReal'))
const SitioGimnasio = dynamic(() => import('@/modules/gimnasio/storefront/SitioReal'))

type Props = ComponentProps<typeof Inicio> & { __industry?: string | null; __subrubros?: string[] | null; __slug?: string | null }

export default function Page(props: Props) {
  const sitio = sitioDelNegocio(props.__industry, props.__subrubros)
  if (sitio === 'alquileres' && props.__slug) return <SitioAlquileres slug={props.__slug} pagina="inicio" />
  if (sitio === 'gimnasio' && props.__slug) return <SitioGimnasio slug={props.__slug} pagina="inicio" />
  return <Inicio {...props} />
}

export { getServerSidePropsInicio as getServerSideProps } from '@/lib/storefront/forceSSR'
