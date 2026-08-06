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

const queryClient = new QueryClient()

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Loader solo para la carga inicial (hidratación de React).
    // La navegación entre módulos usa skeletons internos de cada módulo.
    const timer = setTimeout(() => setLoading(false), 500)
    return () => clearTimeout(timer)
  }, [])

  const isStorefront = router.pathname.startsWith('/tienda')

  // Nombre/logo reales de la tienda para el loader — antes mostraba siempre
  // el mock (TIENDA.nombre) y nunca el logo, sin importar qué tienda fuera.
  // Se pisa apenas resuelve, así que el loader (visible ~500ms) casi siempre
  // ya tiene el dato real puesto antes de desaparecer.
  const [storeMeta, setStoreMeta] = useState<{ nombre: string; logo: string | null; color?: string } | null>(null)
  useEffect(() => {
    if (!isStorefront || !router.isReady) return
    const slug = (router.query.slug as string | undefined) ?? currentSlug()
    if (!slug) return
    let cancelado = false
    getStorefrontConfig(slug).then(cfg => {
      if (cancelado) return
      setStoreMeta({
        nombre: cfg.appearance?.storeName ?? cfg.business.name,
        logo: cfg.appearance?.logoUrl ?? null,
        color: cfg.appearance?.colorPrimary ?? undefined,
      })
    }).catch(() => { /* sin config real, se mantiene el fallback mock */ })
    return () => { cancelado = true }
  }, [isStorefront, router.isReady, router.query.slug])

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
          ? <StorefrontLoader visible={loading} nombre={TIENDA.nombre} />
          : <PageLoader visible={loading} />
        }
        <Component {...pageProps} />
      </AuthProvider>
    </QueryClientProvider>
  )
}
