import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { CheckCircle, Check, Clock, ArrowRight, MessageCircle } from 'lucide-react'
import { CheckoutStepper } from '@/components/storefront/CheckoutStepper'
import { Thumb } from '@/components/storefront/Thumb'
import { fmt, openWpp } from '@/lib/storefront/utils'
import { getStorefrontConfig, toTiendaConfig, type StorefrontConfigResponse } from '@/lib/storefront/api'
import { meGetOrder, ApiError, type MeOrderDetail } from '@/lib/api'

// Estados del pedido en los que el dueño todavía tiene que confirmar algo
// (no llegó/verificó el pago) — el resto de OrderStatus (PREPARING, SHIPPED,
// DELIVERED) ya se muestran como "confirmado" acá, el detalle fino vive en
// Seguimiento.tsx (fase siguiente de esta misma auditoría).
const PENDIENTE: Record<string, boolean> = { PENDING: true }

function hueDeItem(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return h
}

export default function Confirmacion() {
  const router = useRouter()
  const { slug, pedido: pedidoId } = router.query as { slug: string; pedido?: string }
  const base = `/tienda/${slug}`

  const [config, setConfig] = useState<StorefrontConfigResponse | null>(null)
  useEffect(() => {
    if (!slug) return
    let cancelado = false
    getStorefrontConfig(slug).then(cfg => { if (!cancelado) setConfig(cfg) }).catch(() => {})
    return () => { cancelado = true }
  }, [slug])
  const tienda = config ? toTiendaConfig(config) : { nombre: '', sub: '', slug: slug ?? '', dominio: '', wpp: '', email: '' }

  const [pedido, setPedido] = useState<MeOrderDetail | null>(null)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  useEffect(() => {
    if (!pedidoId) return
    let cancelado = false
    meGetOrder(pedidoId)
      .then(p => { if (!cancelado) setPedido(p) })
      .catch(err => { if (!cancelado) setErrorCarga(err instanceof ApiError ? err.message : 'No se pudo cargar el pedido') })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [pedidoId])

  if (cargando) {
    return <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }} />
  }

  if (errorCarga || !pedido) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'grid', placeItems: 'center', padding: 32 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>No pudimos mostrar este pedido</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 20 }}>{errorCarga || 'Pedido no encontrado.'}</div>
          <button onClick={() => router.push(base)} style={{ height: 44, padding: '0 20px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Volver a la tienda
          </button>
        </div>
      </div>
    )
  }

  const pendiente = !!PENDIENTE[pedido.status]
  const accentColor  = pendiente ? '#D97706'              : 'var(--color-success)'
  const accentBg     = pendiente ? 'rgba(245,158,11,0.10)': 'var(--color-success-bg)'
  const accentBorder = pendiente ? 'rgba(245,158,11,0.30)': 'rgba(16,185,129,0.25)'
  const nombreComprador = pedido.onlineOrderDetails?.buyerName?.split(' ')[0] ?? ''

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <style>{`
        @media (max-width: 640px) {
          .sf-conf-bar  { padding: 0 16px !important; }
          .sf-conf-wrap { padding: 20px 16px 48px !important; }
        }
      `}</style>
      <header className="sf-conf-bar" style={{
        position: 'sticky', top: 0, zIndex: 50,
        height: 60, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)',
        padding: '0 32px', display: 'flex', alignItems: 'center',
      }}>
        <a href={base} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          {config?.appearance?.logoUrl
            ? <img src={config.appearance.logoUrl} alt={tienda.nombre} style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'cover' }} />
            : <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg, #2563EB, #3B82F6)', display: 'grid', placeItems: 'center' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />
              </div>}
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{tienda.nombre}</span>
        </a>
      </header>

      <div className="sf-conf-wrap" style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px 64px' }}>
        <CheckoutStepper step={3} />

        <div style={{ textAlign: 'center', maxWidth: 540, margin: '0 auto' }}>
          <div style={{
            width: 88, height: 88, borderRadius: '50%',
            background: accentBg, border: `2px solid ${accentColor}`,
            display: 'grid', placeItems: 'center', margin: '0 auto 20px',
            color: accentColor,
          }}>
            {pendiente
              ? <Clock size={44} strokeWidth={1.5} />
              : <CheckCircle size={44} strokeWidth={1.5} />}
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 12px' }}>
            {pendiente ? 'Pedido registrado' : '¡Pedido confirmado!'}
          </h1>
          <p style={{ fontSize: 15, color: 'var(--color-muted)', marginBottom: 28, maxWidth: 480, margin: '0 auto 28px' }}>
            {pendiente
              ? <>Gracias{nombreComprador ? `, ${nombreComprador}` : ''}. Tu pedido fue recibido — en cuanto el negocio confirme el pago te avisamos por WhatsApp.</>
              : <>Gracias por tu compra{nombreComprador ? `, ${nombreComprador}` : ''}. Te avisamos por WhatsApp cuando esté listo.</>}
          </p>

          <div style={{
            background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            borderRadius: 14, padding: 24, textAlign: 'left',
            boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--color-border)', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-subtle)', marginBottom: 4 }}>Pedido</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>#{pedido.orderNumber}</div>
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                height: 24, padding: '0 10px', borderRadius: 999,
                background: accentBg, color: accentColor,
                fontSize: 11, fontWeight: 700,
              }}>
                {pendiente
                  ? <><Clock size={11} strokeWidth={2.5} /> Pendiente</>
                  : <><Check size={11} strokeWidth={2.5} /> Confirmado</>}
              </span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-subtle)', marginBottom: 4 }}>Fecha</div>
                <div style={{ fontSize: 13, color: 'var(--color-body)', fontFamily: '"Geist Mono", monospace' }}>
                  {new Date(pedido.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>

            {pedido.items.map(it => (
              <div key={it.id} style={{ display: 'flex', gap: 12, padding: '8px 0', alignItems: 'center' }}>
                <Thumb hue={hueDeItem(it.id)} size={48} radius={8} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.productName}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-subtle)', marginTop: 2 }}>
                    {it.variantLabel ? `${it.variantLabel} · ` : ''}x{it.quantity}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>
                  {fmt(it.unitPrice * it.quantity)}
                </div>
              </div>
            ))}

            <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 12, paddingTop: 14 }}>
              {pedido.discountTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: 'var(--color-body)' }}>
                  <span>Descuentos</span>
                  <span style={{ color: 'var(--color-success)', fontFamily: '"Geist Mono", monospace' }}>−{fmt(pedido.discountTotal)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 6, marginBottom: 16 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Total</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmt(pedido.total)}</span>
              </div>
            </div>

            <div style={{
              padding: 14, borderRadius: 10,
              background: accentBg, border: `1px solid ${accentBorder}`,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <MessageCircle size={20} strokeWidth={1.5} color={accentColor} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                  {pendiente ? 'Te avisamos cuando confirmemos el pago' : 'Te contactaremos por WhatsApp'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>También podés escribirnos directo:</div>
              </div>
              {tienda.wpp && (
                <button
                  onClick={() => openWpp(tienda.wpp, `Hola! Acabo de confirmar el pedido #${pedido.orderNumber}.`)}
                  style={{
                    height: 34, padding: '0 12px', borderRadius: 8,
                    background: '#25D366', color: '#fff',
                    fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  }}
                >
                  WhatsApp
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
            <button onClick={() => router.push(base)} style={{
              height: 48, padding: '0 22px', borderRadius: 8,
              background: 'transparent', color: 'var(--color-text)',
              border: '1px solid var(--color-border)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              Seguir comprando
            </button>
            <button onClick={() => router.push(`${base}/pedido/${pedido.id}`)} style={{
              height: 48, padding: '0 22px', borderRadius: 8,
              background: 'var(--color-primary)', color: '#fff',
              fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '0 4px 16px rgba(59,130,246,0.25)',
            }}>
              Ver mi pedido <ArrowRight size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
