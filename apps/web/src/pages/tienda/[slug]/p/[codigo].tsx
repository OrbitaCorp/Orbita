import type { GetServerSideProps } from 'next'
import { getStorefrontProductoCorto } from '@/lib/storefront/api'

// Link corto de un producto para las redes: tienda.orbita.site/p/<código>. No muestra nada: resuelve el código
// y redirige a la ficha. Un código que no existe (o de un producto que ya no se vende) da 404.
export default function LinkCorto() {
  return null
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const slug = typeof params?.slug === 'string' ? params.slug : ''
  const codigo = typeof params?.codigo === 'string' ? params.codigo : ''
  try {
    const { id } = await getStorefrontProductoCorto(slug, codigo)
    // Redirección temporal: el producto puede dejar de venderse y el código tiene que poder dar 404 después.
    return { redirect: { destination: `/producto/${id}`, permanent: false } }
  } catch {
    return { notFound: true }
  }
}
