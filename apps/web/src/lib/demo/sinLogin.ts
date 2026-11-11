// Login, registro y "olvidé mi contraseña" de la tienda: en la demo no
// existen (el visitante ya entra como el cliente Invitado, ver
// lib/auth/authClient.ts), así que redirigen al inicio desde el servidor. En
// cualquier otra tienda, el getServerSideProps de siempre.
import type { GetServerSideProps } from 'next'
import { getServerSideProps as forceSSR } from '@/lib/storefront/forceSSR'
import { esSlugDemo } from './modo'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const slug = typeof ctx.params?.slug === 'string' ? ctx.params.slug : null
  if (slug && esSlugDemo(slug)) {
    // demo.orbita.site/login → "/"; en dev sin subdominio, /tienda/demo/login → /tienda/demo
    const porSubdominio = (ctx.req.headers.host ?? '').startsWith(`${slug}.`)
    return { redirect: { destination: porSubdominio ? '/' : `/tienda/${slug}`, permanent: false } }
  }
  return forceSSR(ctx)
}
