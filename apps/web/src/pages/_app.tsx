import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import type { AppProps } from 'next/app'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@/styles/globals.css'
import 'leaflet/dist/leaflet.css'
import Head from 'next/head'
import { PageLoader } from '@/components/PageLoader'
import { AuthProvider } from '@/lib/auth/AuthContext'
import { CartProvider } from '@/lib/storefront/CartContext'
import { currentSlug } from '@/lib/tenant'
import { getStorefrontConfig } from '@/lib/storefront/api'
import type { StoreMetaSSR, StoreStatusSSR } from '@/lib/storefront/forceSSR'
import { TiendaPausada } from '@/components/storefront/TiendaPausada'

const queryClient = new QueryClient()

// Piso de tiempo que se muestra el loader — puramente estético (evita un
// parpadeo si todo resuelve casi instantáneo), no depende de datos.
const MIN_LOADER_MS = 500

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
  // detecta como hydration mismatch y la página queda trabada en el loader
  // para siempre. `pageProps.__storefront` viene serializado en
  // `__NEXT_DATA__` (ver `lib/storefront/forceSSR.ts`), así que server y
  // cliente ven el mismo valor desde el primer render, sin depender de que
  // el router "esté listo" ni de su timing interno.
  const isStorefront = Boolean((pageProps as { __storefront?: boolean }).__storefront)

  // Decisión 2026-08-15: el loader del storefront pasa a ser SIEMPRE el de
  // Órbita (`PageLoader`, marca de la plataforma) — antes acá se usaba
  // `StorefrontLoader` con el logo/nombre de CADA tienda, y ese componente
  // solo se veía en la carga inicial: `loading` nunca se volvía a activar en
  // navegaciones posteriores dentro del storefront (ir al login, avanzar en
  // el checkout, etc.), así que el spinner desaparecía después del primer
  // load y no volvía a aparecer nunca más. Al unificar en `PageLoader` para
  // toda la app, ya no hace falta esperar a resolver el branding de la
  // tienda (`storeMetaSettled` de antes) antes de poder ocultar el loader —
  // sigue habiendo un fetch de `storeMeta` más abajo, pero ahora es SOLO
  // para `TiendaPausada` (nombre/logo cuando la tienda está pausada), no
  // para el loader.
  const [navegando, setNavegando] = useState(false)
  useEffect(() => {
    if (!isStorefront) return
    const empieza = () => setNavegando(true)
    const termina = () => setNavegando(false)
    router.events.on('routeChangeStart', empieza)
    router.events.on('routeChangeComplete', termina)
    router.events.on('routeChangeError', termina)
    return () => {
      router.events.off('routeChangeStart', empieza)
      router.events.off('routeChangeComplete', termina)
      router.events.off('routeChangeError', termina)
    }
  }, [isStorefront, router.events])

  // Nombre/logo reales de la tienda — hoy solo para `TiendaPausada` (se
  // muestra cuando el negocio está pausado/suspendido). Ya no gatea el
  // loader (ver arriba). Desde 2026-08-07 llega RESUELTO DEL SERVER en
  // `pageProps.__storeMeta` (ver `lib/storefront/forceSSR.ts`); el fetch de
  // abajo es solo el fallback para cuando el server no pudo resolverlo
  // (backend frío) — sin cap de tiempo porque nada espera a que termine.
  //
  // OJO: NO esperar a `router.isReady` para resolver el slug. Confirmado en
  // producción (con el rewrite de subdominios de middleware.ts) que
  // `router.isReady` puede quedarse en `false` para siempre en una página
  // estáticamente optimizada — un bug preexistente del router, no algo que
  // se introdujo acá. `currentSlug()` lee `window.location.host` directo,
  // sin pasar por el router — para el caso real (subdominio) resuelve al
  // toque, sin depender de que el router "esté listo".
  const ssrNombre  = (pageProps as { __storeMeta?: StoreMetaSSR | null }).__storeMeta?.nombre ?? null
  const ssrLogo    = (pageProps as { __storeMeta?: StoreMetaSSR | null }).__storeMeta?.logo ?? null
  // El favicon de cada tienda (Apariencia → faviconUrl) no puede vivir en
  // _document.tsx (es estático y compartido con el panel) — se inyecta acá
  // con next/head, la única pieza común a TODAS las páginas del storefront.
  const ssrFavicon = (pageProps as { __storeMeta?: StoreMetaSSR | null }).__storeMeta?.favicon ?? null

  const [storeMeta, setStoreMeta] = useState<{ nombre: string; logo: string | null } | null>(
    ssrNombre ? { nombre: ssrNombre, logo: ssrLogo } : null,
  )
  useEffect(() => {
    if (!isStorefront || ssrNombre) return
    let cancelado = false
    const slug = currentSlug() ?? (router.isReady && typeof router.query.slug === 'string' ? router.query.slug : undefined)
    if (!slug) return
    getStorefrontConfig(slug).then(cfg => {
      if (cancelado) return
      setStoreMeta({ nombre: cfg.appearance?.storeName ?? cfg.business.name, logo: cfg.appearance?.logoUrl ?? null })
    }).catch(() => { /* sin config real, TiendaPausada se muestra sin nombre/logo */ })
    return () => { cancelado = true }
  }, [isStorefront, ssrNombre, router.isReady, router.query.slug])

  const loading = !minTimeDone || navegando

  // Resuelto en el server (forceSSR.ts) — no depende de ningún fetch del
  // cliente, así que se puede usar desde el primer render sin esperar nada.
  const storeStatus = (pageProps as { __storeStatus?: StoreStatusSSR }).__storeStatus ?? 'ok'
  const storePausada = isStorefront && storeStatus !== 'ok'

  return (
    <QueryClientProvider client={queryClient}>
      {isStorefront && ssrFavicon && (
        <Head>
          <link rel="icon" href={ssrFavicon} />
        </Head>
      )}
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
        <CartProvider>
          {storePausada ? (
            <TiendaPausada status={storeStatus as Exclude<StoreStatusSSR, 'ok'>} nombre={storeMeta?.nombre} logo={storeMeta?.logo} />
          ) : (
            <>
              <PageLoader visible={loading} />
              <Component {...pageProps} />
            </>
          )}
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
