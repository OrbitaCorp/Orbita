import type { GetServerSideProps } from 'next'

// Fuerza SSR en las páginas del storefront en vez de dejar que Next.js las
// optimice automáticamente como estáticas (comportamiento default de un
// page sin getServerSideProps/getStaticProps).
//
// Bug real encontrado en producción (2026-08-06, jaja.orbita.site): la
// combinación "página dinámica auto-estática" + el rewrite de subdominios
// de middleware.ts (NextResponse.rewrite, transparente para el browser —
// la URL real sigue siendo `jaja.orbita.site/`, nunca `/tienda/jaja`) hace
// que el router de Next en el cliente nunca resuelva `router.isReady`
// (queda en `false` para siempre). Como todo el fetch de datos del
// storefront depende de que el router esté listo (o, como mínimo, de que
// React llegue a hidratar), la página quedaba trabada para siempre en el
// loader inicial — confirmado: sin este fix, React ni siquiera hidrata el
// árbol (cero fibers, cero listeners).
//
// Con SSR, el server ya resuelve `params`/`query` a partir del path
// reescrito ANTES de renderizar, así que el HTML que llega al browser trae
// el estado correcto desde el arranque y el cliente hidrata sin quedar
// esperando algo que nunca iba a resolver solo.
//
// `__storefront: true` viaja en `pageProps` (vía __NEXT_DATA__), así que
// server y cliente ven EXACTAMENTE el mismo valor en el primer render. Es la
// misma idea que el fix de `currentSlug()` en _app.tsx: `router.pathname`
// mirado desde `useRouter()` NO es confiable en el primer render del cliente
// para páginas SSR de un catch-all dinámico — confirmado en dev: el primer
// render de cliente evaluaba brevemente `pathname` distinto al del server
// (mostraba el loader genérico `PageLoader` en vez de `StorefrontLoader`),
// lo que React marca como hydration mismatch y deja la página trabada en el
// loader para siempre. `pageProps.__storefront` no tiene ese problema: es un
// dato serializado, no un estado que el router recalcula.
export const getServerSideProps: GetServerSideProps = async () => ({ props: { __storefront: true } })
