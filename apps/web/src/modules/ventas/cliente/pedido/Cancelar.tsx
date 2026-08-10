import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { Breadcrumb } from '@/components/storefront/Breadcrumb'
import { fmt } from '@/lib/storefront/utils'
import { getStorefrontConfig, toTiendaConfig, type StorefrontConfigResponse } from '@/lib/storefront/api'
import { meGetOrder, meCancelOrder, ApiError, type MeOrderDetail } from '@/lib/api'

const MOTIVOS_CANCELACION = ['Me arrepentí de la compra', 'El precio era demasiado alto', 'Encontré algo mejor', 'Error en la compra', 'Demoró mucho', 'Otro']

export default function CancelarPedido() {
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

  const [pedido, setPedido]         = useState<MeOrderDetail | null>(null)
  const [cargando, setCargando]     = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  useEffect(() => {
    if (!id) return
    let cancelado = false
    meGetOrder(id)
      .then(p => { if (!cancelado) setPedido(p) })
      .catch(err => { if (!cancelado) setErrorCarga(err instanceof ApiError ? err.message : 'No se pudo cargar el pedido') })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [id])

  const [motivo,      setMotivo]      = useState('')
  const [showModal,   setShowModal]   = useState(false)
  const [enviando,    setEnviando]    = useState(false)
  const [errorEnvio,  setErrorEnvio]  = useState('')

  if (cargando) {
    return <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }} />
  }

  if (errorCarga || !pedido) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'grid', placeItems: 'center', padding: 32 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>No pudimos cargar este pedido</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 20 }}>{errorCarga || 'Pedido no encontrado.'}</div>
          <button onClick={() => router.push(base)} style={{ height: 44, padding: '0 20px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Volver a la tienda
          </button>
        </div>
      </div>
    )
  }

  // El backend solo deja cancelar pedidos PENDING (ver OrdersService.cancelByCustomer)
  // — si ya lo confirmaron, ni se muestra el formulario.
  if (pedido.status !== 'PENDING') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} />
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 32px 64px', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>Este pedido ya no se puede cancelar</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 20 }}>
            {pedido.status === 'CANCELLED' ? 'Ya está cancelado.' : `Ya está "${pedido.status}" — la tienda ya lo confirmó. Si necesitás cancelarlo, contactala directamente.`}
          </div>
          <button onClick={() => router.push(`${base}/pedido/${id}`)} style={{ height: 44, padding: '0 20px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Volver al pedido
          </button>
        </div>
        <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} />
      </div>
    )
  }

  const confirmarCancelacion = async () => {
    setEnviando(true)
    setErrorEnvio('')
    try {
      await meCancelOrder(id, motivo)
      setShowModal(true)
    } catch (err) {
      setErrorEnvio(err instanceof ApiError ? err.message : 'No se pudo cancelar el pedido')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <style>{`
        @media (max-width: 640px) {
          .sf-can-wrap { padding: 20px 16px 48px !important; }
        }
      `}</style>
      <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} />

      <div className="sf-can-wrap" style={{ maxWidth: 600, margin: '0 auto', padding: '32px 32px 64px' }}>
        <Breadcrumb items={[
          { label: 'Inicio', href: base },
          { label: 'Mi cuenta', href: `${base}/perfil` },
          { label: `Pedido #${pedido.orderNumber}`, href: `${base}/pedido/${id}` },
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
            Esta acción no se puede deshacer.
          </p>

          <div style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 10, padding: 14, marginTop: 20,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, textAlign: 'left',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>#{pedido.orderNumber}</div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                {new Date(pedido.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontFamily: '"Geist Mono", monospace' }}>
              <div style={{ fontSize: 13, color: 'var(--color-body)' }}>{pedido.items.length} producto{pedido.items.length !== 1 ? 's' : ''}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{fmt(pedido.total)}</div>
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

          {errorEnvio && (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: 'var(--color-error-bg)', color: 'var(--color-error)', fontSize: 13, textAlign: 'left' }}>
              {errorEnvio}
            </div>
          )}

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
              onClick={confirmarCancelacion}
              disabled={!motivo || enviando}
              style={{
                flex: 1, height: 48, borderRadius: 8,
                background: motivo && !enviando ? 'var(--color-error)' : 'var(--color-surface-alt)',
                color: '#fff', fontSize: 14, fontWeight: 600,
                border: 'none', cursor: motivo && !enviando ? 'pointer' : 'not-allowed',
              }}
            >
              {enviando ? 'Cancelando...' : 'Sí, cancelar pedido'}
            </button>
          </div>
        </div>
      </div>

      <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} />

      {showModal && (
        <>
          <div
            onClick={() => router.push(base)}
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
              ✓ Pedido cancelado
            </h2>
            <p style={{ fontSize: 14, color: 'var(--color-muted)', textAlign: 'center', lineHeight: 1.5, margin: '0 0 20px' }}>
              Tu pedido #{pedido.orderNumber} fue cancelado.
            </p>
            <button onClick={() => router.push(base)} style={{
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
