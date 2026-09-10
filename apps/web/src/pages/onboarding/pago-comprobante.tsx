import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { RequireAuth } from '@/lib/auth/RequireAuth'
import { ComprobanteBase } from '@/components/shared/ComprobanteBase'
import { Skeleton, SkeletonText } from '@/design-system/components/Skeleton'
import { panelGetSubscriptionPayments, ApiError, type ApiSubscriptionPayment } from '@/lib/api'

// Hallazgo MEDIA "comprobante-fijo" (auditoría 08-09/09): esta pantalla
// mostraba un N° de operación y un monto INVENTADOS, sin exigir sesión ni
// verificar que hubiera un pago real — cualquiera podía abrirla e imprimirla
// como prueba de pago falsa. Ahora exige sesión de dueño (RequireAuth) y
// muestra el último pago real de la suscripción (GET /subscription/payments).

function Contenido() {
  const router = useRouter()
  const autoPrint = router.query.print === '1'

  const [pago, setPago] = useState<ApiSubscriptionPayment | null | undefined>(undefined) // undefined = cargando
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelado = false
    panelGetSubscriptionPayments(1)
      .then((r) => { if (!cancelado) setPago(r.data[0] ?? null) })
      .catch((err) => { if (!cancelado) setError(err instanceof ApiError ? err.message : 'No se pudo cargar el comprobante') })
    return () => { cancelado = true }
  }, [])

  function volver() {
    if (window.history.length <= 1) window.close()
    else router.back()
  }

  if (pago === undefined && !error) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-surface)', display: 'flex', justifyContent: 'center', padding: '40px 16px' }} aria-hidden="true">
        <div style={{ width: '100%', maxWidth: 620 }}>
          <div style={{ height: 90, borderRadius: '14px 14px 0 0', background: 'linear-gradient(135deg, #059669, #10B981)', opacity: 0.5 }} />
          <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderTop: 'none', borderRadius: '0 0 14px 14px', padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <SkeletonText width={140} height={18} />
              <SkeletonText width={90} height={12} />
            </div>
            <SkeletonText width="60%" height={13} delay={60} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <SkeletonText width={110} height={22} delay={120} style={{ borderRadius: 6 }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Sin pago real todavía (cuenta de cortesía, o el webhook de MP no llegó
  // todavía) — mensaje honesto en vez de un comprobante inventado.
  if (error || !pago || pago.status !== 'APPROVED') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'grid', placeItems: 'center', padding: 32 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>Todavía no hay un comprobante</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 20 }}>
            {error || 'No encontramos un pago aprobado para tu cuenta. Si acabás de pagar, puede tardar un minuto en confirmarse.'}
          </div>
          <button className="ds-hover" onClick={volver} style={{ height: 44, padding: '0 20px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Volver
          </button>
        </div>
      </div>
    )
  }

  const fechaPago = pago.paidAt ? new Date(pago.paidAt) : new Date()

  return (
    <ComprobanteBase
      numero={pago.mpPaymentId ?? `SUB-${pago.id.slice(0, 8).toUpperCase()}`}
      fecha={fechaPago.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
      hora={fechaPago.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
      emisor={{ tipo: 'orbita' }}
      headerGradient="linear-gradient(135deg, #059669 0%, #10B981 100%)"
      metadatos={[
        ['Método',  'MercadoPago'],
        ['Estado',  'Aprobado'],
      ]}
      items={[{
        descripcion: 'Órbita — pago de suscripción',
        subtitulo:   `${fechaPago.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })} – ${new Date(pago.periodEnd).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}`,
        qty:         1,
        subtotal:    pago.amount,
      }]}
      totales={[
        { label: 'Total', valor: pago.amount, tipo: 'total' },
      ]}
      textoFooter="Este comprobante acredita el pago realizado a través de MercadoPago."
      onBack={volver}
      backLabel="Volver"
      autoPrint={autoPrint}
    />
  )
}

export default function PagoComprobante() {
  return (
    <RequireAuth type="member">
      <Contenido />
    </RequireAuth>
  )
}
