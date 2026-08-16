import type { GetServerSideProps } from 'next'
import { getStorefrontConfig, StorefrontApiError } from './api'

// Marca/branding de la tienda que el loader necesita para pintarse bien.
// Viaja serializado en `pageProps` (vía __NEXT_DATA__), así que está
// disponible en el PRIMER render — tanto en el HTML del server como en la
// hidratación del cliente.
export type StoreMetaSSR = {
  nombre: string
  logo:   string | null
  color:  string | null
  // Favicon propio del negocio (Apariencia → faviconUrl) — antes se guardaba
  // pero _document.tsx nunca lo leía (es estático, compartido con el panel).
  // _app.tsx lo inyecta con next/head en vez, página por página.
  favicon: string | null
}

// 'ok' es el default optimista: si la config no llegó a tiempo (backend
// frío) se sigue mostrando la tienda normal — nunca se le muestra a un
// cliente real "en pausa" solo porque el server tardó. El bloqueo real de
// verdad (checkout) lo hace el backend igual (assertBusinessOperativo),
// esto es solo la experiencia visual.
//
// 'not_found' es distinto de los demás: no es optimista. Solo se marca
// cuando el backend confirmó un 404 real (el slug no corresponde a ningún
// negocio) — un timeout/error de red NUNCA cae acá, sigue siendo 'ok' (ver
// el catch de abajo). Antes cualquier subdominio sin negocio caía en el
// storefront normal, mostrando un catálogo vacío/roto en vez de avisar que
// ahí no hay ninguna tienda.
export type StoreStatusSSR = 'ok' | 'paused' | 'inactive' | 'not_found'

// Cuánto se espera a la config del backend ANTES de renderizar la página. Si
// tarda más (cold start de Railway), se sigue sin ella y el cliente la pide
// por su cuenta — nunca se bloquea la respuesta del server por esto.
//
// OJO con bajarlo: estaba en 2500ms y la latencia REAL del backend en
// producción es de ~2.3s a 3.9s de forma constante (medido 2026-08-11 contra
// api.orbita.site: /storefront/:slug ≈ 3.2s, /categories ≈ 2.3s, /products
// ≈ 3.7s — no es cold start, es el piso). O sea: la carrera la perdía SIEMPRE,
// el HTML salía con `__storeMeta: null` en cada carga y el loader terminaba
// mostrando el fallback en vez del branding real. Esperar 2500ms para no
// traer nada era el peor de los dos mundos. Este número tiene que quedar por
// ENCIMA de la latencia real; si el backend se acelera, se puede bajar.
const SSR_CONFIG_TIMEOUT_MS = 6000

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
  let storeStatus: StoreStatusSSR = 'ok'
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
          favicon: cfg.appearance?.faviconUrl ?? null,
        }
        // Una tienda pausada o nunca publicada no debería mostrar catálogo ni
        // dejar comprar — "Pausar tienda" en Configuración promete
        // explícitamente "deja de estar visible para tus clientes". Antes
        // esto no se chequeaba en ningún lado del storefront: pausar no
        // ocultaba nada. _app.tsx usa esto para pintar TiendaPausada en vez
        // de la página real, para TODAS las rutas de /tienda/[slug]/**.
        if (cfg.business.isPaused) storeStatus = 'paused'
        else if (!cfg.business.isActive) storeStatus = 'inactive'
      }
    } catch (err) {
      // 404 real del backend (el slug no existe como negocio) — distinto de
      // un error de red/backend caído, que sigue sin branding optimistamente
      // y el cliente reintenta. Nunca rompe el render de la página.
      if (err instanceof StorefrontApiError && err.status === 404) storeStatus = 'not_found'
    }
  }

  // OJO: `null` y no `undefined` — Next exige props serializables a JSON.
  return { props: { __storefront: true, __storeMeta: storeMeta, __storeStatus: storeStatus } }
}
