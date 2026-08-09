import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import type { AppProps } from 'next/app'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/styles/globals.css'
import 'leaflet/dist/leaflet.css'
import { PageLoader } from '@/components/PageLoader'
import { StorefrontLoader } from '@/components/storefront/StorefrontLoader'
import { TIENDA } from '@/lib/storefront/mock'
import { AuthProvider } from '@/lib/auth/AuthContext'
import { currentSlug } from '@/lib/tenant'
import { getStorefrontConfig } from '@/lib/storefront/api'
import type { StoreMetaSSR } from '@/lib/storefront/forceSSR'

const queryClient = new QueryClient()

// Piso de tiempo que se muestra el loader — puramente estético (evita un
// parpadeo si todo resuelve casi instantáneo), no depende de datos.
const MIN_LOADER_MS = 500
// Si la config real tarda más que esto (red lenta, cold start del backend),
// se deja de esperar y se muestra igual el fallback — nunca un loader
// infinito.
const STORE_CONFIG_TIMEOUT_MS = 4000

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()

  const [minTimeDone, setMinTimeDone] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setMinTimeDone(true), MIN_LOADER_MS)
    return () => clearTimeout(timer)
  }, [])

  // OJO: NO derivar esto de `router.pathname`. Confirmado en dev (y explica
  // el bug de fondo en producción): en el primer render del cliente,
  // `useRouter().pathname` puede no coincidir todavía con lo que vio el
  // server para una ruta dinámica con SSR (`/tienda/[slug]`) — React lo
  // detecta como hydration mismatch (server pinta `StorefrontLoader`,
  // cliente intenta pintar `PageLoader` genérico) y la página queda
  // trabada en el loader para siempre. `pageProps.__storefront` viene
  // serializado en `__NEXT_DATA__` (ver `lib/storefront/forceSSR.ts`), así
  // que server y cliente ven el mismo valor desde el primer render, sin
  // depender de que el router "esté listo" ni de su timing interno.
  const isStorefront = Boolean((pageProps as { __storefront?: boolean }).__storefront)

  // Nombre/logo reales de la tienda para el loader — antes mostraba siempre
  // el mock (TIENDA.nombre) y nunca el logo, sin importar qué tienda fuera.
  //
  // El loader NO se puede ocultar apenas pasa MIN_LOADER_MS: en producción
  // (red real, no localhost) ese pedido casi nunca termina en 500ms, así que
  // el loader desaparecía ANTES de que la respuesta llegara y el usuario
  // nunca veía el logo real — quedaba mostrando el "R" de fallback igual.
  // `storeMetaSettled` gatea la visibilidad junto con el piso de tiempo: el
  // loader se queda hasta que el pedido resuelve (éxito o error) o hasta el
  // timeout de seguridad, lo que pase primero.
  //
  // OJO: NO esperar a `router.isReady` para resolver el slug. Confirmado en
  // producción (con el rewrite de subdominios de middleware.ts) que
  // `router.isReady` puede quedarse en `false` para siempre en una página
  // estáticamente optimizada — un bug preexistente del router, no algo que
  // se introdujo acá. Un primer intento de este fix dependía de
  // `router.isReady`/`router.query.slug`, y el loader quedaba colgado
  // infinito en vez de mostrar igual el fallback. `currentSlug()` lee
  // `window.location.host` directo, sin pasar por el router — para el caso
  // real (subdominio) resuelve al toque, sin depender de que el router
  // "esté listo".
  //
  // Desde 2026-08-07 el branding llega RESUELTO DEL SERVER en
  // `pageProps.__storeMeta` (ver `lib/storefront/forceSSR.ts`): el logo real
  // ya viene en el HTML inicial, así que no hay más "flash de la R" del mock
  // mientras se resolvía el fetch del cliente. Cuando eso está presente, el
  // loader queda gateado SOLO por el piso de tiempo — exactamente la misma
  // condición que usa el resto del sitio (`/login`, panel), sin la espera
  // extra que era propia del storefront. El fetch de abajo queda como
  // fallback para cuando el server no pudo resolverlo (backend frío).
  const ssrNombre = (pageProps as { __storeMeta?: StoreMetaSSR | null }).__storeMeta?.nombre ?? null
  const ssrLogo   = (pageProps as { __storeMeta?: StoreMetaSSR | null }).__storeMeta?.logo ?? null
  const ssrColor  = (pageProps as { __storeMeta?: StoreMetaSSR | null }).__storeMeta?.color ?? null

  const [storeMeta, setStoreMeta] = useState<{ nombre: string; logo: string | null; color?: string } | null>(
    ssrNombre ? { nombre: ssrNombre, logo: ssrLogo, color: ssrColor ?? undefined } : null,
  )
  const [storeMetaSettled, setStoreMetaSettled] = useState(Boolean(ssrNombre))
  useEffect(() => {
    if (!isStorefront) { setStoreMetaSettled(true); return }
    // El server ya resolvió el branding: el estado inicial de arriba ya lo
    // tiene, no hay nada que pedir. (Navegar dentro del storefront no cambia
    // de tienda — cambiar de tienda es cambiar de dominio, o sea una carga
    // completa que vuelve a pasar por getServerSideProps.)
    if (ssrNombre) return

    let cancelado = false
    // Cap de seguridad SIEMPRE activo en cuanto corre este efecto — nunca
    // depende de que otra cosa resuelva primero.
    const capTimer = setTimeout(() => { if (!cancelado) setStoreMetaSettled(true) }, STORE_CONFIG_TIMEOUT_MS)

    const slug = currentSlug() ?? (router.isReady && typeof router.query.slug === 'string' ? router.query.slug : undefined)
    if (!slug) {
      // Ruta legado por path (`/tienda/x`) en un host sin subdominio y el
      // router todavía no resolvió `query.slug` — no hay nada más para
      // intentar en esta pasada, pero el cap de arriba igual va a resolver
      // esto en STORE_CONFIG_TIMEOUT_MS si nunca llega a resolver.
      return () => { cancelado = true; clearTimeout(capTimer) }
    }

    getStorefrontConfig(slug).then(cfg => {
      if (cancelado) return
      setStoreMeta({
        nombre: cfg.appearance?.storeName ?? cfg.business.name,
        logo: cfg.appearance?.logoUrl ?? null,
        color: cfg.appearance?.colorPrimary ?? undefined,
      })
    }).catch(() => { /* sin config real, se muestra el fallback mock */ })
      .finally(() => { if (!cancelado) { setStoreMetaSettled(true); clearTimeout(capTimer) } })

    return () => { cancelado = true; clearTimeout(capTimer) }
  }, [isStorefront, ssrNombre, router.isReady, router.query.slug])

  const loading = isStorefront ? !(minTimeDone && storeMetaSettled) : !minTimeDone

  return (
    <QueryClientProvider client={queryClient}>
      {/*
        Script sincrónico — corre antes de que React hidrate.
        Aplica el tema oscuro desde localStorage para evitar flash blanco.
      */}
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          var tema = localStorage.getItem('orbita-theme');
          var prefiereDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (tema === 'dark' || (!tema && prefiereDark)) {
            document.documentElement.classList.add('dark');
          }
        })();
      `}} />
      <AuthProvider>
        {isStorefront
          ? <StorefrontLoader visible={loading} nombre={storeMeta?.nombre ?? TIENDA.nombre} logo={storeMeta?.logo} color={storeMeta?.color} />
          : <PageLoader visible={loading} />
        }
        <Component {...pageProps} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
