// El drawer del carrito, extraído de StorefrontHeader.
//
// Por qué existe como pieza aparte: hasta acá el carrito real vivía adentro
// del header de siempre, así que una plantilla de Home con SU PROPIO navbar
// (ver `headerPropio` en panel/avanzado/plantillas/tipos.ts) no tenía forma
// de abrirlo — su ícono de bolsa era un dibujo. Con el drawer acá afuera, lo
// usan los dos: el header clásico y el navbar de cualquier plantilla, sin
// duplicar ni una línea del carrito.

import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { ShoppingBag, ShoppingCart, X, ArrowRight, Minus, Plus, Trash2 } from 'lucide-react'
import { ProdImage } from './Thumb'
import { fmt } from '@/lib/storefront/utils'
import { useCart } from '@/lib/storefront/CartContext'
import { PromoChip } from '@/modules/ventas/_shared/components'

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const { slug } = router.query as { slug: string }
  const base = `/tienda/${slug}`
  const { items, cartCount, subtotal: cartSubtotal, actualizarQty, quitar, revalidar, descuentoTicket } = useCart()
  const hayNoDisponibles = items.some(i => i.noDisponible)

  // Revalida al abrir — mismo criterio que Carrito.tsx (el CartProvider ya
  // revalida solo al hidratar, esto cubre volver a abrirlo después de un rato).
  useEffect(() => {
    if (open) revalidar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <>
      <style>{`
        @keyframes sfCartSlide { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes sfCartFade  { from { opacity: 0; } to { opacity: 1; } }
        .sf-cart-items { overflow-y: auto; }
        .sf-cart-items::-webkit-scrollbar { width: 4px; }
        .sf-cart-items::-webkit-scrollbar-track { background: transparent; }
        .sf-cart-items::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 999px; }
      `}</style>

      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', animation: 'sfCartFade 220ms ease' }}
      />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(420px, 100vw)',
        background: 'var(--color-bg)',
        zIndex: 201,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.18)',
        animation: 'sfCartSlide 300ms cubic-bezier(0.32,0.72,0,1)',
      }}>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', height: 64,
          borderBottom: '1px solid var(--color-border)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShoppingBag size={18} strokeWidth={1.5} color="var(--color-text)" />
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>Tu carrito</span>
            {cartCount > 0 && (
              <span style={{
                height: 22, padding: '0 8px', borderRadius: 999,
                background: 'var(--color-primary)', color: '#fff',
                fontSize: 11, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center',
              }}>
                {cartCount} {cartCount === 1 ? 'ítem' : 'ítems'}
              </span>
            )}
          </div>
          <button onClick={onClose} className="ds-hover" style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'grid', placeItems: 'center', color: 'var(--color-muted)' }}>
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {items.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--color-surface)', display: 'grid', placeItems: 'center' }}>
              <ShoppingCart size={32} strokeWidth={1.2} color="var(--color-muted)" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>Tu carrito está vacío</div>
              <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>Explorá nuestro catálogo y agregá productos.</div>
            </div>
            <button
              onClick={() => { onClose(); router.push(`${base}/catalogo`) }}
              className="ds-hover"
              style={{ height: 44, padding: '0 22px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              Ver catálogo <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <div className="sf-cart-items" style={{ flex: 1, padding: '4px 20px' }}>
            {items.map((it, i) => {
              const enElTope = it.maxQty !== undefined && it.qty >= it.maxQty
              return (
                <div
                  key={it.id}
                  style={{
                    display: 'flex', gap: 12, padding: '14px 0', alignItems: 'flex-start',
                    borderBottom: i < items.length - 1 ? '1px solid var(--color-border)' : 'none',
                    opacity: it.noDisponible ? 0.55 : 1,
                  }}
                >
                  <ProdImage hue={it.hue} imgUrl={it.imgUrl} height={64} radius={8} style={{ width: 64, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: it.noDisponible ? 'line-through' : 'none' }}>
                        {it.nombre}
                      </div>
                      {it.promoLabel && it.promoId && <PromoChip label={it.promoLabel} promoId={it.promoId} />}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 10 }}>{it.variante}</div>

                    {it.noDisponible ? (
                      <button
                        onClick={() => quitar(it.id)}
                        className="ds-hover"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--color-error)', background: 'var(--color-error-bg)', border: 'none', padding: '5px 9px', borderRadius: 6 }}
                      >
                        <Trash2 size={11} strokeWidth={2} /> No disponible — quitar
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 8, height: 32, overflow: 'hidden' }}>
                          <button
                            onClick={() => actualizarQty(it.id, -1)}
                            className="ds-hover"
                            style={{ width: 32, height: 32, background: 'none', border: 'none', color: it.qty === 1 ? '#EF4444' : 'var(--color-muted)', display: 'grid', placeItems: 'center' }}
                          >
                            {it.qty === 1 ? <Trash2 size={12} strokeWidth={2} /> : <Minus size={12} strokeWidth={2} />}
                          </button>
                          <span style={{ minWidth: 24, textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>
                            {it.qty}
                          </span>
                          <button
                            onClick={() => actualizarQty(it.id, +1)}
                            disabled={enElTope}
                            className="ds-hover"
                            style={{ width: 32, height: 32, background: 'none', border: 'none', cursor: enElTope ? 'not-allowed' : 'pointer', color: enElTope ? 'var(--color-subtle)' : 'var(--color-muted)', display: 'grid', placeItems: 'center' }}
                          >
                            <Plus size={12} strokeWidth={2} />
                          </button>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>
                            {fmt(it.precio * it.qty)}
                          </div>
                          {it.precioAnt && (
                            <div style={{ fontSize: 11, color: 'var(--color-subtle)', textDecoration: 'line-through', fontFamily: '"Geist Mono", monospace' }}>
                              {fmt(it.precioAnt * it.qty)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {items.length > 0 && (
          <div style={{
            padding: '16px 20px 24px',
            borderTop: '1px solid var(--color-border)',
            flexShrink: 0,
            background: 'var(--color-bg)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: descuentoTicket ? 4 : 14 }}>
              <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Subtotal ({cartCount} {cartCount === 1 ? 'ítem' : 'ítems'})</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>
                {fmt(cartSubtotal)}
              </span>
            </div>
            {descuentoTicket && descuentoTicket.monto > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14, gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                  Descuento: {descuentoTicket.nombre} ({descuentoTicket.esPorcentaje ? `${descuentoTicket.valor}%` : fmt(descuentoTicket.valor)})
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-success)', fontFamily: '"Geist Mono", monospace', flexShrink: 0 }}>
                  −{fmt(descuentoTicket.monto)}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => { onClose(); router.push(hayNoDisponibles ? `${base}/carrito` : `${base}/checkout/datos`) }}
                className="ds-hover"
                style={{
                  width: '100%', height: 50, borderRadius: 10,
                  background: hayNoDisponibles ? 'var(--color-surface-alt)' : 'var(--color-primary)',
                  color: hayNoDisponibles ? 'var(--color-muted)' : '#fff',
                  fontSize: 14, fontWeight: 700, border: 'none', cursor: hayNoDisponibles ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: hayNoDisponibles ? 'none' : '0 6px 20px rgba(37,99,235,0.28)',
                }}
              >
                {hayNoDisponibles ? 'Revisá tu carrito' : <>Ir al checkout <ArrowRight size={15} strokeWidth={2} /></>}
              </button>
              <button
                onClick={() => { onClose(); router.push(`${base}/carrito`) }}
                style={{
                  width: '100%', height: 42, borderRadius: 10,
                  background: 'transparent', color: 'var(--color-text)',
                  fontSize: 13, fontWeight: 600, border: '1px solid var(--color-border-strong)', cursor: 'pointer',
                  transition: 'border-color 150ms, color 150ms, background 150ms',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)'
                  e.currentTarget.style.color = 'var(--color-primary)'
                  e.currentTarget.style.background = 'var(--color-primary-bg)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--color-border-strong)'
                  e.currentTarget.style.color = 'var(--color-text)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                Ver carrito completo
              </button>
            </div>

            <p style={{ fontSize: 11, color: 'var(--color-subtle)', textAlign: 'center', margin: '12px 0 0' }}>
              Envío y cupones se calculan en el checkout
            </p>
          </div>
        )}
      </div>
    </>
  )
}
