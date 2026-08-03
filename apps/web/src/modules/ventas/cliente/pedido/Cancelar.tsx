import { useState } from 'react'
import { useRouter } from 'next/router'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { Breadcrumb } from '@/components/storefront/Breadcrumb'
import { TIENDA, CARRITO_INICIAL, PEDIDO_MOCK } from '@/lib/storefront/mock'
import { fmt } from '@/lib/storefront/utils'

const MOTIVOS_CANCELACION = ['Me arrepentí de la compra', 'El precio era demasiado alto', 'Encontré algo mejor', 'Error en la compra', 'Demoró mucho', 'Otro']

export default function CancelarPedido() {
  const router = useRouter()
  const { slug, id } = router.query as { slug: string; id: string }
  const base = `/tienda/${slug}`

  const [motivo,    setMotivo]    = useState('')
  const [showModal, setShowModal] = useState(false)

  const total = CARRITO_INICIAL.reduce((s, i) => s + i.precio * i.qty, 0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <style>{`
        @media (max-width: 640px) {
          .sf-can-wrap { padding: 20px 16px 48px !important; }
        }
      `}</style>
      <StorefrontHeader tienda={TIENDA} carrito={CARRITO_INICIAL} />

      <div className="sf-can-wrap" style={{ maxWidth: 600, margin: '0 auto', padding: '32px 32px 64px' }}>
        <Breadcrumb items={[
          { label: 'Inicio', href: base },
          { label: 'Mi cuenta' },
          { label: `Pedido #${PEDIDO_MOCK.id}`, href: `${base}/pedido/${id}` },
          { label: 'Cancelar' },
        ]} />

        <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 32, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--color-error-bg)', color: 'var(--color-error)',
            display: 'grid', placeItems: 'center', margin: '0 auto 16px',
          }}>
            <AlertTriangle size={26} strokeWidth={1.5} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 8px' }}>
            ¿Cancelar el pedido?
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-muted)', lineHeight: 1.55, maxWidth: 400, margin: '0 auto' }}>
            Esta acción no se puede deshacer. Si el pago ya fue procesado, se iniciará un reembolso.
          </p>

          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 10, padding: 14, marginTop: 20,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, textAlign: 'left',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>#{PEDIDO_MOCK.id}</div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{PEDIDO_MOCK.fecha}</div>
            </div>
            <div style={{ textAlign: 'right', fontFamily: '"Geist Mono", monospace' }}>
              <div style={{ fontSize: 13, color: 'var(--color-body)' }}>3 productos</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{fmt(total)}</div>
            </div>
          </div>

          <div style={{ textAlign: 'left', marginTop: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', display: 'block', marginBottom: 6 }}>
              Motivo de la cancelación
            </label>
            <select
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              style={{
                width: '100%', height: 40, padding: '0 12px', borderRadius: 8,
                background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                color: motivo ? 'var(--color-text)' : 'var(--color-muted)',
                fontSize: 14, outline: 'none',
              }}
            >
              <option value="">Seleccioná un motivo...</option>
              {MOTIVOS_CANCELACION.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div style={{ height: 1, background: 'var(--color-border)', margin: '24px 0' }} />

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => router.push(`${base}/pedido/${id}`)} style={{
              flex: 1, height: 48, borderRadius: 8,
              background: 'transparent', color: 'var(--color-text)',
              border: '1px solid var(--color-border)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              No, mantener pedido
            </button>
            <button
              onClick={() => setShowModal(true)}
              disabled={!motivo}
              style={{
                flex: 1, height: 48, borderRadius: 8,
                background: motivo ? 'var(--color-error)' : 'var(--color-surface-alt)',
                color: '#fff', fontSize: 14, fontWeight: 600,
                border: 'none', cursor: motivo ? 'pointer' : 'not-allowed',
              }}
            >
              Sí, cancelar pedido
            </button>
          </div>
        </div>
      </div>

      <StorefrontFooter tienda={TIENDA} slug={slug} />

      {showModal && (
        <>
          <div
            onClick={() => setShowModal(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(0,0,0,0.55)' }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 151, width: 'calc(100% - 48px)', maxWidth: 440,
            background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            borderRadius: 14, padding: 28, boxShadow: '0 24px 56px rgba(0,0,0,0.20)',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--color-success-bg)', color: 'var(--color-success)',
              display: 'grid', placeItems: 'center', margin: '0 auto 16px',
            }}>
              <CheckCircle size={28} strokeWidth={1.5} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-success)', textAlign: 'center', margin: '0 0 8px' }}>
              ✓ Solicitud enviada
            </h2>
            <p style={{ fontSize: 14, color: 'var(--color-muted)', textAlign: 'center', lineHeight: 1.5, margin: '0 0 20px' }}>
              Te contactaremos por WhatsApp para confirmar la cancelación y el reembolso si aplica.
            </p>
            <button onClick={() => { setShowModal(false); router.push(base) }} style={{
              width: '100%', height: 48, borderRadius: 8,
              background: 'var(--color-primary)', color: '#fff',
              fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
            }}>
              Volver al inicio
            </button>
          </div>
        </>
      )}
    </div>
  )
}
