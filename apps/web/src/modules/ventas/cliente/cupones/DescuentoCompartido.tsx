import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Sparkles, Tag, Calendar, ArrowRight } from 'lucide-react'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { FloatingWhatsapp } from '@/components/storefront/FloatingWhatsapp'
import { Breadcrumb } from '@/components/storefront/Breadcrumb'
import { ProductCard } from '@/components/storefront/ProductCard'
import { Skeleton, SkeletonText, SkeletonProductGrid } from '@/design-system/components/Skeleton'
import { fmt } from '@/lib/storefront/utils'
import {
  getStorefrontConfig, getStorefrontDiscountLanding, getStorefrontProducts,
  toTiendaConfig, toOferta, toProducto,
  StorefrontApiError, type StorefrontConfigResponse,
} from '@/lib/storefront/api'
import type { Oferta, Producto } from '@/lib/storefront/types'

// Link compartible de un DESCUENTO (no cupón — sin código, nada que copiar ni
// aplicar a mano: es automático). A diferencia de DescuentoExclusivo.tsx
// (cupón, canje en el checkout), acá el link promete productos puntuales —
// el punto es navegar directo a verlos, con el descuento ya reflejado en
// cada card (precio tachado, mismo componente que el catálogo real).
export default function DescuentoCompartido() {
  const router = useRouter()
  const { slug, id } = router.query as { slug: string; id: string }
  const base = `/tienda/${slug}`

  const [config, setConfig] = useState<StorefrontConfigResponse | null>(null)
  useEffect(() => {
    if (!slug) return
    let cancelado = false
    getStorefrontConfig(slug).then(cfg => { if (!cancelado) setConfig(cfg) }).catch(() => {})
    return () => { cancelado = true }
  }, [slug])
  const tienda = config ? toTiendaConfig(config) : { nombre: '', sub: '', slug: slug ?? '', dominio: '', wpp: '', email: '' }

  const [oferta, setOferta] = useState<Oferta | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!slug || !id) return
    let cancelado = false
    setCargando(true)
    getStorefrontDiscountLanding(slug, id)
      .then(d => { if (!cancelado) setOferta(toOferta(d)) })
      .catch(err => { if (!cancelado) setErrorMsg(err instanceof StorefrontApiError ? err.message : 'Este descuento no existe o ya no está disponible.') })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [slug, id])

  const [productos, setProductos] = useState<Producto[] | null>(null)
  const [cargandoProductos, setCargandoProductos] = useState(false)
  useEffect(() => {
    if (!slug || !id || !oferta || oferta.alcance === 'ticket') return
    let cancelado = false
    setCargandoProductos(true)
    getStorefrontProducts(slug, { discountId: id, limit: 24 })
      .then(r => { if (!cancelado) setProductos(r.data.map(p => toProducto(p))) })
      .catch(() => { if (!cancelado) setProductos([]) })
      .finally(() => { if (!cancelado) setCargandoProductos(false) })
    return () => { cancelado = true }
  }, [slug, id, oferta])

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} esVidriera={config?.business?.mode === 'SHOWCASE'} />
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 32px 64px' }} aria-hidden="true">
          <SkeletonText width={220} height={12} style={{ marginBottom: 24 }} />
          <Skeleton width="100%" height={140} radius={16} style={{ marginBottom: 32 }} />
          <SkeletonProductGrid cantidad={8} columns="repeat(4, 1fr)" cardHeight={200} />
        </div>
      </div>
    )
  }

  if (!oferta) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-surface)', display: 'grid', placeItems: 'center' }}>
          <Tag size={32} strokeWidth={1.2} color="var(--color-muted)" />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Enlace no válido</h1>
        <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: 0, maxWidth: 340 }}>{errorMsg}</p>
        <button
          className="ds-hover"
          onClick={() => router.push(`${base}/catalogo`)}
          style={{ height: 44, padding: '0 22px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600 }}
        >
          Ver catálogo
        </button>
      </div>
    )
  }

  const etiquetaValor = oferta.tipo === 'porcentaje' ? `${oferta.valor}%` : fmt(oferta.valor)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <style>{`
        @media (max-width: 1024px) {
          .sf-deal-banner { padding: 36px 28px !important; }
          .sf-deal-pct    { font-size: 56px !important; }
        }
        @media (max-width: 768px) {
          .sf-deal-wrap   { padding: 16px 16px 48px !important; }
          .sf-deal-banner { padding: 28px 20px !important; }
          .sf-deal-pct    { font-size: 48px !important; }
          .sf-deal-body   { flex-direction: column !important; gap: 24px !important; }
        }
      `}</style>
      <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} esVidriera={config?.business?.mode === 'SHOWCASE'} />

      {/* ── Banner ── */}
      <div
        className="sf-deal-banner"
        style={{
          background: 'linear-gradient(135deg, #1E1B4B 0%, #4C1D95 55%, #7C3AED 100%)',
          padding: '52px 48px',
          position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(ellipse 55% 70% at 85% 50%, rgba(167,139,250,0.18) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(139,92,246,0.12)', pointerEvents: 'none' }} />

        <div className="sf-deal-body" style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', display: 'flex', alignItems: 'center', gap: 52 }}>
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <div className="sf-deal-pct" style={{ fontSize: 80, fontWeight: 900, lineHeight: 1, color: '#fff', fontFamily: '"Geist Mono", monospace', letterSpacing: '-0.04em' }}>
              {etiquetaValor}
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.70)', marginTop: 2, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              OFF
            </div>
          </div>

          <div style={{ width: 1, height: 80, background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />

          <div style={{ flex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 24, padding: '0 10px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', marginBottom: 12 }}>
              <Sparkles size={11} color="#C4B5FD" strokeWidth={2} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#C4B5FD', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Descuento</span>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {oferta.descripcion}
            </h1>
            {oferta.minCompra && (
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.72)', margin: '0 0 18px', lineHeight: 1.6 }}>
                Válido en compras a partir de {fmt(oferta.minCompra)}.
              </p>
            )}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {oferta.vencimiento && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                  <Calendar size={12} /> Vence el {oferta.vencimiento}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                <Tag size={12} /> Válido en {oferta.categorias ? oferta.categorias.join(', ') : 'toda la tienda'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sf-deal-wrap" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 32px 64px' }}>
        <Breadcrumb items={[{ label: 'Inicio', href: base }, { label: 'Descuento' }]} />

        {cargandoProductos ? (
          <div style={{ marginBottom: 28 }} aria-hidden="true">
            <SkeletonText width={220} height={20} style={{ marginBottom: 16 }} />
            <SkeletonProductGrid cantidad={8} columns="repeat(auto-fill, minmax(200px, 1fr))" cardHeight={200} />
          </div>
        ) : productos && productos.length > 0 ? (
          <>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 16px' }}>
              Productos con este descuento
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
              {productos.map(p => <ProductCard key={p.id} producto={p} mode={config?.business?.mode === 'SHOWCASE' ? 'SHOWCASE' : 'FULL'} />)}
            </div>
          </>
        ) : productos && productos.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '0 0 20px' }}>
            No hay productos disponibles con este descuento en este momento.
          </p>
        ) : null}

        <button
          className="ds-hover"
          onClick={() => router.push(`${base}/catalogo`)}
          style={{
            height: 48, padding: '0 22px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff',
            fontSize: 14, fontWeight: 700, border: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
        >
          Ver todo el catálogo <ArrowRight size={16} />
        </button>
      </div>

      <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
      <FloatingWhatsapp wpp={tienda.wpp} visible={!!config?.appearance?.showWhatsapp && !!tienda.wpp} message={config?.appearance?.whatsappText} />
    </div>
  )
}
