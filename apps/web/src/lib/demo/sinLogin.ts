// Login, registro y "olvidé mi contraseña" de la tienda: en la demo no
// existen (el visitante ya entra como el cliente Invitado, ver
// lib/auth/authClient.ts), así que redirigen al inicio desde el servidor. En
// cualquier otra tienda, el getServerSideProps de siempre.
import type { GetServerSideProps } from 'next'
import { getServerSideProps as forceSSR } from '@/lib/storefront/forceSSR'
import { DEMO_SLUG } from './modo'

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  if (ctx.params?.slug === DEMO_SLUG) {
    // demo.orbita.site/login → "/"; en dev sin subdominio, /tienda/demo/login → /tienda/demo
    const porSubdominio = (ctx.req.headers.host ?? '').startsWith(`${DEMO_SLUG}.`)
    return { redirect: { destination: porSubdominio ? '/' : `/tienda/${DEMO_SLUG}`, permanent: false } }
  }
  return forceSSR(ctx)
}
