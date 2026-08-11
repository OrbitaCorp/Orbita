import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { FloatingWhatsapp } from '@/components/storefront/FloatingWhatsapp'
import { AnnouncementBar } from '@/components/storefront/AnnouncementBar'
import { ProductCard } from '@/components/storefront/ProductCard'
import { Breadcrumb } from '@/components/storefront/Breadcrumb'
import type { Producto, TiendaConfig } from '@/lib/storefront/types'
import {
  getStorefrontConfig, getStorefrontCategories, getStorefrontProducts,
  toTiendaConfig, toCategoria, toProducto,
  type StorefrontConfigResponse, type StorefrontCategoryItem,
} from '@/lib/storefront/api'

export default function Categoria() {
  const router = useRouter()
  const { slug, categoria } = router.query as { slug: string; categoria: string }
  const base = `/tienda/${slug}`

  const [config, setConfig] = useState<StorefrontConfigResponse | null>(null)
  const [categorias, setCategorias] = useState<StorefrontCategoryItem[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [cargando, setCargando] = useState(true)

  const cat = categorias.find(c => c.slug === categoria) ?? null

  useEffect(() => {
    if (!slug) return
    let cancelado = false
    getStorefrontConfig(slug).then(cfg => { if (!cancelado) setConfig(cfg) }).catch(() => {})
    getStorefrontCategories(slug).then(cats => { if (!cancelado) setCategorias(cats) }).catch(() => {})
    return () => { cancelado = true }
  }, [slug])

  useEffect(() => {
    if (!slug || !cat) return
    let cancelado = false
    setCargando(true)
    getStorefrontProducts(slug, { categoryId: cat.id, limit: 24 })
      .then(r => { if (!cancelado) setProductos(r.data.map(p => toProducto(p, { showNew: config?.appearance?.showNewBadge, showOffer: config?.appearance?.showOfferBadge, showLowStock: config?.appearance?.showLowStock }))) })
      .catch(() => { if (!cancelado) setProductos([]) })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [slug, cat])

  const tienda: TiendaConfig = config ? toTiendaConfig(config) : { nombre: '', sub: '', slug: slug ?? '', dominio: '', wpp: '', email: '' }

  if (!cargando && !cat) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} />
        <AnnouncementBar text={config?.appearance?.shippingText} visible={config?.appearance?.showAnnouncementBar ?? true} />
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '80px 32px', textAlign: 'center', color: 'var(--color-muted)' }}>
          Esta categoría no existe.
        </div>
        <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
      <FloatingWhatsapp wpp={tienda.wpp} visible={!!config?.appearance?.showWhatsapp && !!tienda.wpp} message={config?.appearance?.whatsappText} />
      </div>
    )
  }

  const hue = cat ? toCategoria(cat).hue : 220
  const otras = categorias.filter(c => c.id !== cat?.id)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} />
      <AnnouncementBar />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 32px' }}>
        <Breadcrumb items={[{ label: 'Inicio', href: base }, { label: 'Catálogo', href: `${base}/catalogo` }, { label: cat?.name ?? '' }]} />

        <div style={{ background: `oklch(0.94 0.04 ${hue})`, borderRadius: 18, padding: 36, display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24, alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-0.03em', color: '#0F172A', margin: '0 0 8px' }}>{cat?.name}</h1>
            <p style={{ fontSize: 15, color: '#334155', maxWidth: 380, marginBottom: 20 }}>Explorá toda nuestra selección de {cat?.name.toLowerCase()}.</p>
            <div style={{ display: 'flex', gap: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', fontFamily: '"Geist Mono", monospace' }}>{cat?.productCount ?? 0}</div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>modelos</div>
              </div>
            </div>
          </div>
          <div style={{ height: 200, background: `oklch(0.84 0.06 ${hue})`, borderRadius: 14 }} />
        </div>

        {!cargando && productos.length === 0 ? (
          <div style={{ padding: '40px 0 48px', textAlign: 'center', color: 'var(--color-muted)', fontSize: 14 }}>
            No hay productos en esta categoría todavía.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 48 }}>
            {productos.map(p => <ProductCard key={p.id} producto={p} />)}
          </div>
        )}

        {otras.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-subtle)', marginBottom: 16 }}>Otras categorías</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {otras.map(c => {
                const h = toCategoria(c).hue
                return (
                  <a key={c.id} href={`${base}/catalogo/${c.slug}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 20, borderRadius: 12, background: 'var(--color-bg)', border: '1px solid var(--color-border)', textDecoration: 'none' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `oklch(0.94 0.04 ${h})`, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-muted)', fontFamily: '"Geist Mono", monospace' }}>{c.productCount} productos</div>
                    </div>
                  </a>
                )
              })}
            </div>
          </>
        )}
      </div>
      <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
      <FloatingWhatsapp wpp={tienda.wpp} visible={!!config?.appearance?.showWhatsapp && !!tienda.wpp} message={config?.appearance?.whatsappText} />
    </div>
  )
}
