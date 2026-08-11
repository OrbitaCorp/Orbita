import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Minus, Plus, Trash2, ChevronLeft, Lock, ShoppingCart, ArrowRight, Tag } from 'lucide-react'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { Breadcrumb } from '@/components/storefront/Breadcrumb'
import { Thumb } from '@/components/storefront/Thumb'
import { fmt } from '@/lib/storefront/utils'
import { useCart } from '@/lib/storefront/CartContext'
import { getStorefrontConfig, toTiendaConfig, type StorefrontConfigResponse } from '@/lib/storefront/api'
import type { TiendaConfig } from '@/lib/storefront/types'

export default function Carrito() {
  const router = useRouter()
  const { slug } = router.query as { slug: string }
  const base = `/tienda/${slug}`

  // Marca real de la tienda (logo/nombre) — antes esta pantalla usaba
  // siempre TIENDA (mock), así que el header/footer mostraban una tienda
  // distinta de la que el cliente estaba mirando. Mismo patrón que
  // Catalogo.tsx/Inicio.tsx.
  const [config, setConfig] = useState<StorefrontConfigResponse | null>(null)
  useEffect(() => {
    if (!slug) return
    let cancelado = false
    getStorefrontConfig(slug).then(cfg => { if (!cancelado) setConfig(cfg) }).catch(() => {})
    return () => { cancelado = true }
  }, [slug])
  const tienda: TiendaConfig = config ? toTiendaConfig(config) : { nombre: '', sub: '', slug: slug ?? '', dominio: '', wpp: '', email: '' }

  // Carrito real (CartContext) — antes arrancaba siempre de CARRITO_INICIAL
  // (mock), sin importar qué haya agregado el cliente de verdad.
  const { items, actualizarQty, quitar } = useCart()

  const subtotalLista  = items.reduce((s, i) => s + (i.precioAnt ?? i.precio) * i.qty, 0)
  const descuentoItems = items.reduce((s, i) => s + (i.precioAnt ? (i.precioAnt - i.precio) * i.qty : 0), 0)
  const total           = subtotalLista - descuentoItems

  if (items.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} />
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 32px 0' }}>
          <Breadcrumb items={[{ label: 'Inicio', href: base }, { label: 'Tu carrito' }]} />
        </div>
        <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 32px', textAlign: 'center' }}>
          <div style={{
            width: 96, height: 96, borderRadius: '50%',
            background: 'var(--color-surface)', color: 'var(--color-muted)',
            display: 'grid', placeItems: 'center', margin: '0 auto 24px',
          }}>
            <ShoppingCart size={44} strokeWidth={1.2} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text)', margin: '0 0 12px' }}>Tu carrito está vacío</h1>
          <p style={{ fontSize: 15, color: 'var(--color-muted)', marginBottom: 28 }}>
            Explorá nuestro catálogo y empezá a agregar productos que te gusten.
          </p>
          <button onClick={() => router.push(`${base}/catalogo`)} style={{
            height: 52, padding: '0 28px', borderRadius: 10,
            background: 'var(--color-primary)', color: '#fff',
            fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            Ir al catálogo <ArrowRight size={16} strokeWidth={2} />
          </button>
        </div>
        <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <style>{`
        @media (max-width: 768px) {
          .sf-cart-wrap   { padding: 16px 16px 40px !important; }
          .sf-cart-layout { grid-template-columns: 1fr !important; }
          .sf-cart-aside  { position: static !important; }
          .sf-cart-item   { grid-template-columns: 64px 1fr !important; }
          .sf-cart-price  { display: none !important; }
        }
      `}</style>
      <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} />

      <div className="sf-cart-wrap" style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 32px 48px' }}>
        <Breadcrumb items={[{ label: 'Inicio', href: base }, { label: 'Tu carrito' }]} />
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '16px 0 4px' }}>
          Tu carrito
        </h1>
        <div style={{ fontSize: 14, color: 'var(--color-muted)', marginBottom: 32, fontFamily: '"Geist Mono", monospace' }}>
          ({items.length} productos · {items.reduce((s, i) => s + i.qty, 0)} unidades)
        </div>

        <div className="sf-cart-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 32, alignItems: 'flex-start' }}>

          <div>
            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '4px 24px' }}>
              {items.map((it, idx) => {
                const enOferta = !!it.precioAnt
                const ahorra   = enOferta ? (it.precioAnt! - it.precio) * it.qty : 0
                return (
                  <div
                    key={it.id}
                    className="sf-cart-item"
                    style={{
                      display: 'grid', gridTemplateColumns: '80px 1fr auto',
                      gap: 16, alignItems: 'flex-start',
                      padding: '20px 0',
                      borderBottom: idx < items.length - 1 ? '1px solid var(--color-border)' : 'none',
                    }}
                  >
                    <button
                      onClick={() => router.push(`${base}/producto/${it.productId}`)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'block' }}
                      title="Ver producto"
                    >
                      <Thumb hue={it.hue} size={80} radius={10} />
                    </button>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{it.nombre}</span>
                        {enOferta && (
                          <span style={{
                            display: 'inline-flex', height: 20, padding: '0 7px', borderRadius: 999,
                            background: 'var(--color-error-bg)', color: 'var(--color-error)',
                            fontSize: 10, fontWeight: 700, alignItems: 'center',
                          }}>Oferta</span>
                        )}
                      </div>
                      {it.variante && <div style={{ fontSize: 12, color: 'var(--color-muted)', marginBottom: 10 }}>{it.variante}</div>}
                      {ahorra > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--color-success)', fontWeight: 500, marginBottom: 10, fontFamily: '"Geist Mono", monospace' }}>
                          Ahorrás {fmt(ahorra)} en este producto
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 8, height: 32 }}>
                          <button onClick={() => actualizarQty(it.id, -1)} style={{ width: 28, height: 32, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)', display: 'grid', placeItems: 'center' }}>
                            <Minus size={12} />
                          </button>
                          <span style={{ width: 26, textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{it.qty}</span>
                          <button onClick={() => actualizarQty(it.id, 1)} style={{ width: 28, height: 32, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text)', display: 'grid', placeItems: 'center' }}>
                            <Plus size={12} />
                          </button>
                        </div>
                        <button
                          onClick={() => quitar(it.id)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 12, color: 'var(--color-muted)',
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '4px 8px', borderRadius: 6, transition: 'all 150ms',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-error)'; e.currentTarget.style.background = 'var(--color-error-bg)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--color-muted)'; e.currentTarget.style.background = 'transparent' }}
                        >
                          <Trash2 size={12} /> Eliminar
                        </button>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>
                        {fmt(it.precio * it.qty)}
                      </div>
                      {enOferta && (
                        <div style={{ fontSize: 12, color: 'var(--color-subtle)', textDecoration: 'line-through', marginTop: 2, fontFamily: '"Geist Mono", monospace' }}>
                          {fmt(it.precioAnt! * it.qty)}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <button
              onClick={() => router.push(`${base}/catalogo`)}
              style={{
                marginTop: 16, fontSize: 13, fontWeight: 500, color: 'var(--color-primary)',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <ChevronLeft size={14} /> Seguir comprando
            </button>
          </div>

          <aside className="sf-cart-aside" style={{
            background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            borderRadius: 12, padding: 24, position: 'sticky', top: 76,
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 20px' }}>Resumen del pedido</h2>

            {/* El cupón se valida y aplica de verdad en el paso de pago (ahí
                el backend confirma que existe, está vigente y aplica a estos
                productos) — antes esta pantalla mostraba "ORBITA10" aplicado
                siempre con un 10% de descuento inventado, al lado de precios
                que ahora sí son reales. Se saca esa simulación; queda el link
                a cupones disponibles, que sí es real (CuponesPublicos.tsx). */}
            <button
              onClick={() => router.push(`${base}/cupones`)}
              style={{
                marginBottom: 20, fontSize: 12.5, color: 'var(--color-primary)', fontWeight: 500,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              <Tag size={12} /> Ver cupones disponibles
            </button>

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 0 }}>
              <SumLine label="Subtotal"                  value={fmt(subtotalLista)} />
              {descuentoItems > 0 && <SumLine label="Desc. productos en oferta" value={`−${fmt(descuentoItems)}`} good />}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: 'var(--color-body)' }}>
                <span>Envío</span>
                <span style={{ fontSize: 12, color: 'var(--color-muted)', fontStyle: 'italic' }}>Se coordina por WhatsApp</span>
              </div>
              <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 12, paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>Total</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmt(total)}</span>
              </div>
            </div>

            <button
              onClick={() => router.push(`${base}/checkout/datos`)}
              style={{
                width: '100%', height: 52, marginTop: 20, borderRadius: 10,
                background: 'var(--color-primary)', color: '#fff',
                fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 8px 24px rgba(59,130,246,0.30)',
              }}
            >
              Ir a checkout <ArrowRight size={16} strokeWidth={2} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, fontSize: 12, color: 'var(--color-muted)' }}>
              <Lock size={12} strokeWidth={1.5} /> Pago 100% seguro
            </div>
          </aside>
        </div>
      </div>

      <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
    </div>
  )
}

function SumLine({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 0' }}>
      <span style={{ fontSize: 13, color: 'var(--color-body)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: good ? 'var(--color-success)' : 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>
        {value}
      </span>
    </div>
  )
}
