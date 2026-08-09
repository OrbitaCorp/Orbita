import type { GetServerSideProps } from 'next'
import { getStorefrontConfig } from './api'

// Marca/branding de la tienda que el loader necesita para pintarse bien.
// Viaja serializado en `pageProps` (vía __NEXT_DATA__), así que está
// disponible en el PRIMER render — tanto en el HTML del server como en la
// hidratación del cliente.
export type StoreMetaSSR = {
  nombre: string
  logo:   string | null
  color:  string | null
}

// Cuánto se espera a la config del backend ANTES de renderizar la página. Si
// tarda más (cold start de Railway), se sigue sin ella y el cliente la pide
// por su cuenta — nunca se bloquea la respuesta del server por esto.
const SSR_CONFIG_TIMEOUT_MS = 2500

// Fuerza SSR en las páginas del storefront en vez de dejar que Next.js las
// optimice automáticamente como estáticas (comportamiento default de un
// page sin getServerSideProps/getStaticProps), y de paso resuelve el
// branding de la tienda del lado del server.
//
// Por qué SSR: la combinación "página dinámica auto-estática" + el rewrite de
// subdominios de middleware.ts (NextResponse.rewrite, transparente para el
// browser — la URL real sigue siendo `jaja.orbita.site/`, nunca
// `/tienda/jaja`) dejaba a `router.isReady` sin resolver. Con SSR el server ya
// resuelve `params`/`query` a partir del path reescrito ANTES de renderizar.
//
// `__storefront: true` viaja en `pageProps` para que _app.tsx sepa que es una
// página de tienda sin mirar `router.pathname` (que en el primer render del
// cliente puede no coincidir con el del server para una ruta dinámica → React
// lo marca como hydration mismatch y la página queda trabada en el loader).
//
// `__storeMeta` resuelve el otro bug visible (2026-08-07): el loader mostraba
// la inicial "R" del MOCK (`TIENDA.nombre` es literalmente "Rama
// Indumentaria") en vez del logo real, porque el logo solo llegaba después de
// un fetch del lado del cliente. Trayéndolo acá, el HTML que sale del server
// ya viene con el logo/nombre/color correctos: se ven desde el primer byte,
// sin depender de que el JS haya corrido.
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const slug = typeof ctx.params?.slug === 'string' ? ctx.params.slug : null

  let storeMeta: StoreMetaSSR | null = null
  if (slug) {
    try {
      // Carrera contra un timeout: si el backend está frío, la tienda igual
      // responde (el cliente completa el branding después).
      const cfg = await Promise.race([
        getStorefrontConfig(slug),
        new Promise<null>(resolve => setTimeout(() => resolve(null), SSR_CONFIG_TIMEOUT_MS)),
      ])
      if (cfg) {
        storeMeta = {
          nombre: cfg.appearance?.storeName ?? cfg.business.name,
          logo:   cfg.appearance?.logoUrl ?? null,
          color:  cfg.appearance?.colorPrimary ?? null,
        }
      }
    } catch {
      // Tienda inexistente o backend caído: se sigue sin branding y el
      // cliente reintenta. Nunca rompe el render de la página.
    }
  }

  // OJO: `null` y no `undefined` — Next exige props serializables a JSON.
  return { props: { __storefront: true, __storeMeta: storeMeta } }
}
