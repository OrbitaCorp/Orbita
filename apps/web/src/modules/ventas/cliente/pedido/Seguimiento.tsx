import { useRouter } from 'next/router'
import { Check, RotateCcw, X, ChevronRight, Mail, MessageCircle, FileText, Printer } from 'lucide-react'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { Breadcrumb } from '@/components/storefront/Breadcrumb'
import { Thumb } from '@/components/storefront/Thumb'
import { TIENDA, CARRITO_INICIAL, PEDIDO_MOCK } from '@/lib/storefront/mock'
import { fmt, openWpp } from '@/lib/storefront/utils'

export default function SeguimientoPedido() {
  const router = useRouter()
  const { slug, id } = router.query as { slug: string; id: string }
  const base = `/tienda/${slug}`

  const timeline    = PEDIDO_MOCK.timeline
  const currentStep = timeline.findIndex(s => !s.done)
  const activeIdx   = currentStep === -1 ? timeline.length - 1 : currentStep - 1
  const statusLabel = timeline[activeIdx]?.label ?? 'Pendiente'

  const statusColor = (label: string) => {
    if (label === 'Entregado')      return { bg: '#DCFCE7', color: '#16A34A' }
    if (label === 'Enviado')        return { bg: '#DBEAFE', color: '#2563EB' }
    if (label === 'En preparación') return { bg: '#FEF9C3', color: '#CA8A04' }
    if (label === 'Confirmado')     return { bg: '#F0FDF4', color: '#15803D' }
    return { bg: 'var(--color-surface)', color: 'var(--color-muted)' }
  }
  const badge = statusColor(statusLabel)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <StorefrontHeader tienda={TIENDA} />

      <style>{`
        @media (max-width: 768px) {
          .sf-seg-wrap   { padding: 20px 16px 48px !important; }
          .sf-seg-layout { grid-template-columns: 1fr !important; }
          .sf-seg-sidebar { position: static !important; }
        }
      `}</style>
      <div className="sf-seg-wrap" style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 32px 64px' }}>
        <Breadcrumb items={[
          { label: 'Inicio', href: base },
          { label: 'Mi cuenta' },
          { label: `Pedido #${PEDIDO_MOCK.id}` },
        ]} />

        <div className="sf-seg-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Encabezado pedido */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>#{PEDIDO_MOCK.id}</div>
                <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 2 }}>{PEDIDO_MOCK.fecha}</div>
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                height: 28, padding: '0 14px', borderRadius: 999,
                background: badge.bg, color: badge.color,
                fontSize: 12, fontWeight: 700,
              }}>
                {statusLabel}
              </span>
            </div>

            {/* Estado del pedido */}
            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 24px' }}>Estado del pedido</h3>

              <div style={{ position: 'relative' }}>
                {timeline.map((step, i) => {
                  const isDone   = i < currentStep || currentStep === -1
                  const isActive = i === currentStep && currentStep < timeline.length && currentStep !== -1
                  return (
                    <div key={i} style={{ display: 'flex', gap: 16, position: 'relative', paddingBottom: i < timeline.length - 1 ? 28 : 0 }}>
                      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: isDone ? 'var(--color-success)' : isActive ? 'var(--color-primary)' : 'var(--color-surface)',
                          border: `2px solid ${isDone ? 'var(--color-success)' : isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                          color: '#fff', display: 'grid', placeItems: 'center', zIndex: 2, flexShrink: 0,
                        }}>
                          {isDone ? <Check size={14} strokeWidth={2.5} /> : isActive ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} /> : null}
                        </div>
                        {i < timeline.length - 1 && (
                          <div style={{
                            position: 'absolute', top: 28, bottom: -28, left: '50%',
                            width: 2, transform: 'translateX(-50%)',
                            background: isDone ? 'var(--color-success)' : 'var(--color-border)',
                          }} />
                        )}
                      </div>
                      <div style={{ flex: 1, paddingTop: 4, paddingBottom: i < timeline.length - 1 ? 0 : 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: (isDone || isActive) ? 'var(--color-text)' : 'var(--color-muted)' }}>
                          {step.label}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-subtle)', marginTop: 2, fontFamily: '"Geist Mono", monospace' }}>
                          {step.fecha}
                        </div>
                        {isActive && (
                          <div style={{ fontSize: 12, color: 'var(--color-primary)', marginTop: 6, fontWeight: 500 }}>
                            El vendedor actualizará el estado en breve.
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Detalle del pedido */}
            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 16px' }}>Detalle del pedido</h3>
              {CARRITO_INICIAL.map((it, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 0', borderBottom: i < CARRITO_INICIAL.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <Thumb hue={it.hue} size={64} radius={8} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>{it.nombre}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{it.variante} · x{it.qty}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>
                    {fmt(it.precio * it.qty)}
                  </div>
                </div>
              ))}
            </div>

            {/* Acciones del pedido */}
            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 14px' }}>Acciones del pedido</h3>
              {[
                { Icon: RotateCcw, label: 'Iniciar devolución', href: `${base}/pedido/${id}/devolucion`, color: 'var(--color-body)' },
                { Icon: X,         label: 'Cancelar pedido',    href: `${base}/pedido/${id}/cancelar`,   color: 'var(--color-error)' },
              ].map((a, i) => (
                <button
                  key={a.label}
                  onClick={() => router.push(a.href)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 8px', textAlign: 'left', width: '100%',
                    fontSize: 14, fontWeight: 500, color: a.color,
                    borderTop: i > 0 ? '1px solid var(--color-border)' : 'none',
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderRadius: 8, transition: 'background 150ms',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <a.Icon size={16} strokeWidth={1.5} color={a.color} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{a.label}</span>
                  <ChevronRight size={14} color="var(--color-subtle)" />
                </button>
              ))}
            </div>
          </div>

          {/* Sidebar derecho */}
          <div className="sf-seg-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <SideCard title="Contacto con la tienda">
              <button
                onClick={() => openWpp(TIENDA.wpp, `Hola! Tengo una consulta sobre mi pedido #${PEDIDO_MOCK.id}`)}
                style={{
                  width: '100%', height: 44, borderRadius: 10,
                  background: '#25D366', color: '#fff',
                  fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8,
                }}
              >
                <MessageCircle size={16} strokeWidth={1.5} /> WhatsApp
              </button>
              <button style={{
                width: '100%', height: 44, borderRadius: 10,
                background: 'transparent', color: 'var(--color-text)',
                border: '1px solid var(--color-border)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Mail size={16} strokeWidth={1.5} /> Email
              </button>
            </SideCard>

            <SideCard title="Entrega">
              <div style={{ fontSize: 13, color: 'var(--color-body)', lineHeight: 1.55 }}>
                <strong style={{ color: 'var(--color-text)' }}>María Fernández</strong><br />
                Av. Corrientes 1234, Piso 5 B<br />
                CABA · C1043AAZ
              </div>
              <button
                onClick={() => openWpp(TIENDA.wpp, `Hola! Quería consultar sobre el envío del pedido #${PEDIDO_MOCK.id}`)}
                style={{
                  marginTop: 12, fontSize: 13, color: 'var(--color-success)', fontWeight: 500,
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <MessageCircle size={13} strokeWidth={1.5} /> Coordinar por WhatsApp →
              </button>
            </SideCard>

            {/* Comprobante */}
            <SideCard title="Comprobante de pago">
              <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 14, lineHeight: 1.5 }}>
                Tu comprobante oficial de compra para este pedido.
              </div>
              <button
                onClick={() => router.push(`${base}/pedido/${id}/comprobante`)}
                style={{
                  width: '100%', height: 44, borderRadius: 10,
                  background: 'var(--color-primary)', color: '#fff',
                  fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8,
                }}
              >
                <FileText size={15} strokeWidth={1.5} /> Ver comprobante
              </button>
              <button
                onClick={() => { router.push(`${base}/pedido/${id}/comprobante`).then(() => window.print()) }}
                style={{
                  width: '100%', height: 44, borderRadius: 10,
                  background: 'transparent', color: 'var(--color-text)',
                  border: '1px solid var(--color-border)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Printer size={15} strokeWidth={1.5} /> Imprimir
              </button>
            </SideCard>
          </div>
        </div>
      </div>

      <StorefrontFooter tienda={TIENDA} slug={slug} />
    </div>
  )
}

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}
