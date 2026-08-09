import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { Landmark, Lock, ChevronLeft, Store, Wallet, CheckCircle2, Clock, Tag, AlertTriangle } from 'lucide-react'
import { CheckoutStepper } from '@/components/storefront/CheckoutStepper'
import { Thumb } from '@/components/storefront/Thumb'
import { fmt } from '@/lib/storefront/utils'
import { useCart } from '@/lib/storefront/CartContext'
import { getStorefrontConfig, toTiendaConfig, type StorefrontConfigResponse } from '@/lib/storefront/api'
import { checkoutStorefront, ApiError, type CheckoutInput } from '@/lib/api'
import { loadCheckoutDraft, clearCheckoutDraft } from '@/lib/storefront/checkoutDraft'

type Metodo = 'CASH' | 'TRANSFER' | 'PICKUP'

const METODO_META: Record<Metodo, { Icon: React.ElementType; titulo: string; desc: string }> = {
  CASH:     { Icon: Wallet,   titulo: 'Efectivo',        desc: 'Pagás al recibir o al retirar' },
  TRANSFER: { Icon: Landmark, titulo: 'Transferencia',   desc: 'Coordinás el comprobante por WhatsApp' },
  PICKUP:   { Icon: Store,    titulo: 'Retiro en local',  desc: 'Reservamos el stock, pagás al retirar' },
}

export default function CheckoutPago() {
  const router  = useRouter()
  const { slug } = router.query as { slug: string }
  const base = `/tienda/${slug}`
  const { items, subtotal, vaciar } = useCart()

  const [config, setConfig] = useState<StorefrontConfigResponse | null>(null)
  useEffect(() => {
    if (!slug) return
    let cancelado = false
    getStorefrontConfig(slug).then(cfg => { if (!cancelado) setConfig(cfg) }).catch(() => {})
    return () => { cancelado = true }
  }, [slug])
  const tienda = config ? toTiendaConfig(config) : { nombre: '', sub: '', slug: slug ?? '', dominio: '', wpp: '', email: '' }

  useEffect(() => {
    if (slug && items.length === 0) router.replace(`${base}/carrito`)
  }, [slug, items.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sin datos del paso 1 (nombre/email/dirección), no hay a quién facturarle
  // el pedido — se vuelve a pedirlos en vez de mandar algo incompleto.
  const draft = useMemo(() => (slug ? loadCheckoutDraft(slug) : null), [slug])
  useEffect(() => {
    if (slug && !draft) router.replace(`${base}/checkout/datos`)
  }, [slug, draft]) // eslint-disable-line react-hooks/exhaustive-deps

  // Métodos que el negocio activó de verdad en Configuración — Mercado Pago
  // no se ofrece: sin conexión OAuth real con la cuenta del negocio, no hay
  // forma de procesar ese pago (fase aparte).
  const metodosDisponibles = useMemo<Metodo[]>(() => {
    const p = config?.payment
    if (!p) return []
    return (['CASH', 'TRANSFER', 'PICKUP'] as Metodo[]).filter(m =>
      m === 'CASH' ? p.acceptsCash : m === 'TRANSFER' ? p.acceptsTransfer : p.acceptsPickup,
    )
  }, [config])

  const [metodo, setMetodo] = useState<Metodo | null>(null)
  useEffect(() => {
    if (!metodo && metodosDisponibles.length > 0) setMetodo(metodosDisponibles[0])
  }, [metodosDisponibles, metodo])

  const [cupon, setCupon] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const descuentoEfectivo = metodo === 'CASH' && config?.payment?.cashDiscountPercent
    ? Math.round(subtotal * config.payment.cashDiscountPercent) / 100
    : 0
  const total = Math.max(0, subtotal - descuentoEfectivo)

  async function confirmar() {
    if (!draft || !metodo || enviando) return
    setEnviando(true)
    setError('')
    try {
      const payload: CheckoutInput = {
        items: items.map(it => ({ variantId: it.id, quantity: it.qty })),
        buyer: draft.buyer,
        shippingAddressId: draft.shippingAddressId,
        paymentMethod: metodo,
        couponCode: cupon.trim() || undefined,
      }
      const pedido = await checkoutStorefront(slug, payload)
      vaciar()
      clearCheckoutDraft(slug)
      router.push(`${base}/checkout/confirmacion?pedido=${pedido.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo confirmar el pedido')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        height: 60, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)',
        padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <a href={base} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          {config?.appearance?.logoUrl
            ? <img src={config.appearance.logoUrl} alt={tienda.nombre} style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'cover' }} />
            : <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg, #2563EB, #3B82F6)', display: 'grid', placeItems: 'center' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />
              </div>}
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{tienda.nombre}</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-muted)' }}>
          <Lock size={13} strokeWidth={1.5} /> Pago seguro
        </div>
      </header>

      <style>{`
        @media (max-width: 768px) {
          .sf-pago-wrap   { padding: 24px 16px 48px !important; }
          .sf-pago-layout { grid-template-columns: 1fr !important; }
          .sf-pago-aside  { position: static !important; }
        }
      `}</style>
      <div className="sf-pago-wrap" style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px 64px' }}>
        <CheckoutStepper step={2} />
        <div className="sf-pago-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32, alignItems: 'flex-start' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 16px' }}>Método de pago</h2>

              {config && metodosDisponibles.length === 0 && (
                <div style={{ display: 'flex', gap: 10, padding: 16, borderRadius: 10, background: 'var(--color-warning-bg)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <AlertTriangle size={18} strokeWidth={1.8} color="#D97706" style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: 13, color: 'var(--color-body)' }}>
                    Esta tienda todavía no activó ningún método de pago. Escribinos por WhatsApp para coordinar la compra.
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {metodosDisponibles.map(id => {
                  const m = METODO_META[id]
                  const active = metodo === id
                  return (
                    <div
                      key={id}
                      onClick={() => setMetodo(id)}
                      style={{
                        padding: 16, borderRadius: 10, cursor: 'pointer',
                        background: active ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                        border: `2px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        transition: 'all 150ms',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                          background: active ? 'var(--color-primary)' : 'transparent',
                          border: `2px solid ${active ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
                          display: 'grid', placeItems: 'center',
                        }}>
                          {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                        </div>
                        <m.Icon size={20} strokeWidth={1.5} color="var(--color-body)" />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                            {m.titulo}
                            {id === 'CASH' && !!config?.payment?.cashDiscountPercent && (
                              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: 'var(--color-success)', background: 'var(--color-success-bg)', padding: '2px 8px', borderRadius: 999 }}>
                                −{config.payment.cashDiscountPercent}%
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{m.desc}</div>
                        </div>
                      </div>

                      {/* ── Panel Transferencia (alias real) ── */}
                      {active && id === 'TRANSFER' && (
                        <div style={{ marginTop: 16, padding: 16, borderRadius: 10, background: 'var(--color-success-bg)', border: '1px solid rgba(16,185,129,0.30)' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>Datos para transferir</div>
                          <div style={{ display: 'flex', gap: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.50)' }}>
                            <span style={{ color: 'var(--color-subtle)', minWidth: 56, fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Alias</span>
                            <span style={{ color: 'var(--color-text)', fontWeight: 600, fontFamily: '"Geist Mono", monospace', fontSize: 13 }}>{config?.payment?.transferAlias ?? '—'}</span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--color-success)', marginTop: 10, fontWeight: 500 }}>
                            Coordinamos la confirmación del pago por WhatsApp una vez que confirmes el pedido.
                          </div>
                        </div>
                      )}

                      {/* ── Panel Retiro en local (dirección real) ── */}
                      {active && id === 'PICKUP' && (
                        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ padding: 14, borderRadius: 10, background: 'var(--color-warning-bg)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <CheckCircle2 size={16} strokeWidth={2} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>Tu stock queda reservado</div>
                              <div style={{ fontSize: 12, color: 'var(--color-body)', marginTop: 2 }}>Al confirmar, reservamos los productos. Abonás al retirar.</div>
                            </div>
                          </div>
                          <div style={{ padding: 16, borderRadius: 10, background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-subtle)', marginBottom: 12 }}>Punto de retiro</div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: config?.contact?.scheduleText ? 10 : 0 }}>
                              <Store size={16} strokeWidth={1.5} color="var(--color-muted)" style={{ flexShrink: 0, marginTop: 1 }} />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{tienda.nombre}</div>
                                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 1 }}>
                                  {config?.payment?.pickupAddress ?? 'La tienda todavía no cargó una dirección — te la va a pasar por WhatsApp.'}
                                </div>
                              </div>
                            </div>
                            {config?.contact?.scheduleText && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Clock size={15} strokeWidth={1.5} color="var(--color-muted)" style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{config.contact.scheduleText}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ── Panel Efectivo ── */}
                      {active && id === 'CASH' && !!config?.payment?.cashDiscountPercent && (
                        <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: 'var(--color-success-bg)', border: '1px solid rgba(16,185,129,0.30)', fontSize: 13, color: 'var(--color-success)', fontWeight: 500 }}>
                          Pagando en efectivo, el total baja a <strong>{fmt(total)}</strong> ({config.payment.cashDiscountPercent}% menos).
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {metodosDisponibles.length > 0 && (
              <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <Tag size={13} /> ¿Tenés un cupón?
                </label>
                <input
                  value={cupon}
                  onChange={e => setCupon(e.target.value)}
                  placeholder="Código del cupón (opcional)"
                  style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 13, outline: 'none', fontFamily: '"Geist Mono", monospace', textTransform: 'uppercase', boxSizing: 'border-box' }}
                />
              </div>
            )}

            {error && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--color-error-bg)', border: '1px solid var(--color-error)', color: 'var(--color-error)', fontSize: 13 }}>
                {error}
              </div>
            )}

            <button
              onClick={() => void confirmar()}
              disabled={!metodo || enviando || metodosDisponibles.length === 0}
              style={{
                width: '100%', height: 56, borderRadius: 12,
                background: (!metodo || metodosDisponibles.length === 0) ? 'var(--color-surface-alt)' : 'var(--color-primary)',
                color: (!metodo || metodosDisponibles.length === 0) ? 'var(--color-muted)' : '#fff',
                fontSize: 15, fontWeight: 700, border: 'none', cursor: (!metodo || enviando) ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: metodo ? '0 12px 32px rgba(59,130,246,0.30)' : 'none',
                opacity: enviando ? 0.7 : 1,
              }}
            >
              <Lock size={16} strokeWidth={1.5} />
              {enviando ? 'Confirmando…' : metodo === 'PICKUP' ? 'Reservar y retirar en local' : 'Confirmar compra'} ·{' '}
              <span style={{ fontFamily: '"Geist Mono", monospace' }}>{fmt(total)}</span>
            </button>

            <button onClick={() => router.push(`${base}/checkout/datos`)} style={{
              fontSize: 13, color: 'var(--color-primary)', fontWeight: 500,
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
            }}>
              <ChevronLeft size={14} /> Volver a datos
            </button>
          </div>

          <aside className="sf-pago-aside" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24, position: 'sticky', top: 76 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-subtle)', marginBottom: 14 }}>
              Resumen del pedido
            </div>
            {items.map(it => (
              <div key={it.id} style={{ display: 'flex', gap: 12, padding: '8px 0', alignItems: 'center' }}>
                <Thumb hue={it.hue} size={56} radius={8} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.nombre}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-subtle)', marginTop: 2 }}>x{it.qty}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmt(it.precio * it.qty)}</div>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12, marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                <span style={{ color: 'var(--color-body)' }}>Subtotal</span>
                <span style={{ color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmt(subtotal)}</span>
              </div>
              {descuentoEfectivo > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                  <span style={{ color: 'var(--color-body)' }}>Desc. por efectivo</span>
                  <span style={{ color: 'var(--color-success)', fontFamily: '"Geist Mono", monospace' }}>−{fmt(descuentoEfectivo)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10, marginTop: 6, borderTop: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Total</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmt(total)}</span>
              </div>
              {cupon.trim() && (
                <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 8, fontStyle: 'italic' }}>
                  El cupón se valida al confirmar.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
