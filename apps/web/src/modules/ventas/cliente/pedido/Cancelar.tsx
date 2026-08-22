import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { AlertTriangle, CheckCircle } from 'lucide-react'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { Breadcrumb } from '@/components/storefront/Breadcrumb'
import { Skeleton, SkeletonCircle, SkeletonText } from '@/design-system/components/Skeleton'
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

  // Solo aplica cuando la cancelación pasa a ser una SOLICITUD (no en el
  // autocancelado directo de PENDING, que no tiene nada que reembolsar
  // todavía) — mismo criterio que Devolucion.tsx.
  const pagadoConMp = (pedido?.payments ?? []).some(p => p.method === 'MERCADOPAGO' && p.status === 'APPROVED')
  const creditNoteDisponible = config?.payment?.cancellationsCreditNoteEnabled ?? false
  const mpRefundDisponible = (config?.payment?.cancellationsMpRefundEnabled ?? true) && pagadoConMp
  const [refundMethod, setRefundMethod] = useState<'CREDIT_NOTE' | 'REFUND' | null>(null)
  useEffect(() => {
    if (creditNoteDisponible && !mpRefundDisponible) setRefundMethod('CREDIT_NOTE')
    else if (!creditNoteDisponible && mpRefundDisponible) setRefundMethod('REFUND')
  }, [creditNoteDisponible, mpRefundDisponible])

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} />
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 32px 64px' }} aria-hidden="true">
          <SkeletonText width={220} height={12} style={{ marginBottom: 24 }} />
          <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 32, textAlign: 'center' }}>
            <SkeletonCircle size={56} style={{ margin: '0 auto 16px' }} />
            <SkeletonText width={200} height={20} delay={40} style={{ margin: '0 auto 10px', borderRadius: 6 }} />
            <SkeletonText width={280} height={11} delay={70} style={{ margin: '0 auto 4px' }} />
            <SkeletonText width={220} height={11} delay={90} style={{ margin: '4px auto 0' }} />
            <Skeleton width="100%" height={58} radius={10} delay={130} style={{ marginTop: 20 }} />
            <Skeleton width="100%" height={40} radius={8} delay={170} style={{ marginTop: 20 }} />
            <div style={{ height: 1, background: 'var(--color-border)', margin: '24px 0' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <Skeleton height={44} radius={8} delay={210} style={{ flex: 1 }} />
              <Skeleton height={44} radius={8} delay={240} style={{ flex: 1 }} />
            </div>
          </div>
        </div>
      </div>
    )
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

  // Autocancelación directa solo mientras está PENDING (nunca hay plata de
  // Mercado Pago ya cobrada de por medio ahí). Confirmado/En preparación
  // siguen pudiendo PEDIR la cancelación — el negocio la tiene que aceptar o
  // rechazar (ver CancellationsService) — de Enviado en adelante, ya no: de
  // ahí en más se resuelve como devolución.
  const puedeCancelarDirecto = pedido.status === 'PENDING'
  const puedePedirCancelacion = (pedido.status === 'CONFIRMED' || pedido.status === 'PREPARING')
    && config?.payment?.cancellationsEnabled !== false
  const solicitudPendiente = pedido.cancellationRequests.find(c => c.status === 'PENDING')

  if (solicitudPendiente) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} />
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 32px 64px', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>Ya pediste cancelar este pedido</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 20 }}>
            Está esperando que la tienda lo revise — te avisamos por email en cuanto se resuelva.
          </div>
          <button onClick={() => router.push(`${base}/pedido/${id}`)} style={{ height: 44, padding: '0 20px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Volver al pedido
          </button>
        </div>
        <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
      </div>
    )
  }

  if (!puedeCancelarDirecto && !puedePedirCancelacion) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} />
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 32px 64px', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
            {config?.payment?.cancellationsEnabled === false ? 'Esta tienda no acepta cancelaciones' : 'Este pedido ya no se puede cancelar'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 20 }}>
            {config?.payment?.cancellationsEnabled === false
              ? 'Si tenés un problema con tu pedido, escribinos directo por WhatsApp.'
              : pedido.status === 'CANCELLED' ? 'Ya está cancelado.' : `Ya está "${pedido.status}" — de acá en más, cualquier problema se resuelve como devolución.`}
          </div>
          <button onClick={() => router.push(`${base}/pedido/${id}`)} style={{ height: 44, padding: '0 20px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Volver al pedido
          </button>
        </div>
        <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
      </div>
    )
  }

  const faltaElegirMetodo = puedePedirCancelacion && creditNoteDisponible && mpRefundDisponible && !refundMethod

  const confirmarCancelacion = async () => {
    if (faltaElegirMetodo) {
      setErrorEnvio('Elegí cómo preferís que te devuelvan el dinero')
      return
    }
    setEnviando(true)
    setErrorEnvio('')
    try {
      await meCancelOrder(id, motivo, puedePedirCancelacion ? (refundMethod ?? undefined) : undefined)
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
      <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} />

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
            {puedeCancelarDirecto ? '¿Cancelar el pedido?' : '¿Pedir la cancelación?'}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-muted)', lineHeight: 1.55, maxWidth: 400, margin: '0 auto' }}>
            {puedeCancelarDirecto
              ? 'Esta acción no se puede deshacer.'
              : 'Como la tienda ya confirmó tu pedido, no se cancela solo — se lo pedimos y la tienda lo revisa. Si pagaste con Mercado Pago, se te reembolsa automáticamente si lo aceptan.'}
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

          {puedePedirCancelacion && creditNoteDisponible && mpRefundDisponible && (
            <div style={{ textAlign: 'left', marginTop: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', display: 'block', marginBottom: 6 }}>
                ¿Cómo preferís que te devuelvan el dinero?
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {([['CREDIT_NOTE', 'Nota de crédito'], ['REFUND', 'Reembolso a Mercado Pago']] as const).map(([m, label]) => {
                  const active = refundMethod === m
                  return (
                    <button
                      key={m} type="button"
                      onClick={() => setRefundMethod(m)}
                      style={{
                        height: 38, padding: '0 16px', borderRadius: 999,
                        border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: active ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                        color: active ? 'var(--color-primary)' : 'var(--color-body)',
                        fontSize: 13, fontWeight: active ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

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
              disabled={!motivo || enviando || faltaElegirMetodo}
              style={{
                flex: 1, height: 48, borderRadius: 8,
                background: motivo && !enviando && !faltaElegirMetodo ? 'var(--color-error)' : 'var(--color-surface-alt)',
                color: '#fff', fontSize: 14, fontWeight: 600,
                border: 'none', cursor: motivo && !enviando && !faltaElegirMetodo ? 'pointer' : 'not-allowed',
              }}
            >
              {enviando ? 'Enviando...' : puedeCancelarDirecto ? 'Sí, cancelar pedido' : 'Sí, pedir cancelación'}
            </button>
          </div>
        </div>
      </div>

      <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />

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
              {puedeCancelarDirecto ? '✓ Pedido cancelado' : '✓ Cancelación pedida'}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--color-muted)', textAlign: 'center', lineHeight: 1.5, margin: '0 0 20px' }}>
              {puedeCancelarDirecto
                ? `Tu pedido #${pedido.orderNumber} fue cancelado.`
                : `La tienda va a revisar tu pedido de cancelación del pedido #${pedido.orderNumber} — te avisamos por email en cuanto se resuelva.`}
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
