import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { Check, X as XIcon, RotateCcw, X, ChevronRight, Mail, MessageCircle, FileText, Printer, Truck, Copy } from 'lucide-react'
import { StorefrontHeader } from '@/components/storefront/StorefrontHeader'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { Breadcrumb } from '@/components/storefront/Breadcrumb'
import { ProdImage } from '@/components/storefront/Thumb'
import { Skeleton, SkeletonCircle, SkeletonText } from '@/design-system/components/Skeleton'
import { fmt, openWpp } from '@/lib/storefront/utils'
import { getStorefrontConfig, toTiendaConfig, type StorefrontConfigResponse } from '@/lib/storefront/api'
import { meGetOrder, ApiError, type MeOrderDetail, type ApiCarrier, type ApiReturnStatus, type ApiCancellationStatus } from '@/lib/api'

// "Seguimiento de pedido" = los ESTADOS del pedido (PENDING → CONFIRMED →
// PREPARING → SHIPPED → DELIVERED), que el admin cambia a mano desde el
// panel — abajo. El tracking LOGÍSTICO (transportista + código, ver más
// abajo en el sidebar "Entrega") es aparte: sin integración con ningún
// correo, el dueño lo carga a mano desde el panel; acá solo se muestra si
// ya lo cargó — nunca un número inventado.
const PASOS: { status: string; label: string }[] = [
  { status: 'PENDING',    label: 'Pendiente' },
  { status: 'CONFIRMED',  label: 'Confirmado' },
  { status: 'PREPARING',  label: 'En preparación' },
  { status: 'SHIPPED',    label: 'Enviado' },
  { status: 'DELIVERED',  label: 'Entregado' },
]

const ESTADO_UI: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:    { label: 'Pendiente',      bg: 'var(--color-warning-bg)', color: '#B45309' },
  CONFIRMED:  { label: 'Confirmado',     bg: '#F0FDF4', color: '#15803D' },
  PREPARING:  { label: 'En preparación', bg: '#FEF9C3', color: '#CA8A04' },
  SHIPPED:    { label: 'Enviado',        bg: '#DBEAFE', color: '#2563EB' },
  DELIVERED:  { label: 'Entregado',      bg: '#DCFCE7', color: '#16A34A' },
  CANCELLED:  { label: 'Cancelado',      bg: 'var(--color-error-bg)', color: 'var(--color-error)' },
}

// Estado de la devolución — mismo criterio de colores que Devoluciones.tsx
// del panel (ESTADO_CHIP), traducido a lo que le importa al cliente: acá no
// hay "En proceso" visible como paso propio porque el cliente no gestiona
// nada, solo ve en qué quedó.
const DEVOLUCION_UI: Record<ApiReturnStatus, { label: string; bg: string; color: string }> = {
  PENDING:    { label: 'Devolución pendiente de revisión', bg: 'var(--color-warning-bg)', color: '#B45309' },
  IN_PROCESS: { label: 'Devolución en proceso',             bg: '#DBEAFE',                color: '#2563EB' },
  APPROVED:   { label: 'Devolución aprobada',                bg: '#DCFCE7',                color: '#16A34A' },
  REJECTED:   { label: 'Devolución rechazada',               bg: 'var(--color-error-bg)',  color: 'var(--color-error)' },
}

const CANCELACION_UI: Record<ApiCancellationStatus, { label: string; bg: string; color: string }> = {
  PENDING:  { label: 'Cancelación pendiente de revisión', bg: 'var(--color-warning-bg)', color: '#B45309' },
  APPROVED: { label: 'Cancelación aprobada',               bg: '#DCFCE7',                color: '#16A34A' },
  REJECTED: { label: 'Cancelación rechazada',               bg: 'var(--color-error-bg)',  color: 'var(--color-error)' },
}

// Link público de seguimiento de cada transportista — se probó a mano que
// ninguno soporta precargar el código en la URL (Correo Argentino busca por
// AJAX en la misma página, sin query param), así que el link lleva a su
// buscador oficial y el código se muestra al lado para copiar y pegar. Sin
// scraping: es más frágil que confiable, y va contra los términos de uso de
// los propios correos — mejor un link + copiar que un dato roto en silencio.
const CARRIER_LABEL: Record<ApiCarrier, string> = {
  CORREO_ARGENTINO: 'Correo Argentino', OCA: 'OCA', ANDREANI: 'Andreani', VIA_CARGO: 'Via Cargo', OTRO: 'Transportista',
}
const CARRIER_TRACKING_URL: Record<ApiCarrier, string> = {
  CORREO_ARGENTINO: 'https://www.correoargentino.com.ar/formularios/e-commerce',
  OCA: 'https://www.oca.com.ar/Seguimiento/Paquetes/aca',
  ANDREANI: 'https://www.andreani.com/?tab=seguir-envio',
  VIA_CARGO: 'https://www.viacargo.com.ar/',
  OTRO: '',
}

function hueDeItem(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return h
}

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function SeguimientoPedido() {
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

  const [pedido, setPedido]       = useState<MeOrderDetail | null>(null)
  const [cargando, setCargando]   = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [trackingCopiado, setTrackingCopiado] = useState(false)
  const copiarTracking = async (codigo: string) => {
    try {
      await navigator.clipboard.writeText(codigo)
    } catch {
      // clipboard API puede no estar disponible (http sin TLS, permisos, etc.) —
      // el código ya queda seleccionable a mano en pantalla como respaldo.
      return
    }
    setTrackingCopiado(true)
    setTimeout(() => setTrackingCopiado(false), 2000)
  }
  useEffect(() => {
    if (!id) return
    let cancelado = false
    meGetOrder(id)
      .then(p => { if (!cancelado) setPedido(p) })
      .catch(err => { if (!cancelado) setErrorCarga(err instanceof ApiError ? err.message : 'No se pudo cargar el pedido') })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [id])

  if (cargando) {
    // Mismo layout de dos columnas que la pantalla real (ver el return de
    // abajo) — antes esta pantalla mostraba un stepper HORIZONTAL de puntos
    // conectados, algo así como el del checkout, cuando "Estado del pedido"
    // en la pantalla real es una línea de tiempo VERTICAL con su propia
    // card+título; el resto tampoco tenía card ni título propios. El salto
    // entre skeleton y contenido real quedaba muy visible (cambiaba de
    // forma, no solo de contenido). Ahora calca la forma real: card+título
    // para "Estado del pedido" (5 círculos en columna, no en fila) y
    // "Detalle del pedido", y en el sidebar 3 cards del mismo alto que
    // Contacto/Entrega/Comprobante (títulos + botones de 44px, no genéricos).
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} />
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 32px 64px' }} aria-hidden="true">
          <SkeletonText width={260} height={12} style={{ marginBottom: 24 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Encabezado: número + fecha, badge de estado */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <SkeletonText width={90} height={24} style={{ marginBottom: 6 }} />
                  <SkeletonText width={140} height={12} delay={30} />
                </div>
                <Skeleton width={90} height={28} radius={999} delay={40} />
              </div>

              {/* Estado del pedido — línea de tiempo vertical, no horizontal */}
              <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
                <SkeletonText width={140} height={16} style={{ marginBottom: 24 }} />
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} style={{ display: 'flex', gap: 16, paddingBottom: i < 5 ? 28 : 0 }}>
                    <SkeletonCircle size={28} delay={i * 40} />
                    <div style={{ flex: 1, paddingTop: 4 }}>
                      <SkeletonText width={100} height={13} delay={i * 40 + 20} style={{ marginBottom: 6 }} />
                      <SkeletonText width={70} height={11} delay={i * 40 + 40} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Detalle del pedido */}
              <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
                <SkeletonText width={150} height={16} style={{ marginBottom: 16 }} />
                {[1, 2].map(i => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
                    <Skeleton width={64} height={64} radius={8} delay={i * 60} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <SkeletonText width="55%" height={13} delay={i * 60 + 20} />
                      <SkeletonText width="25%" height={11} delay={i * 60 + 40} />
                    </div>
                    <SkeletonText width={56} height={13} delay={i * 60 + 60} />
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12 }}>
                  <SkeletonText width={50} height={14} />
                  <SkeletonText width={70} height={16} delay={20} />
                </div>
              </div>
            </div>

            {/* Sidebar: mismas 3 cards que la pantalla real, con el mismo
                alto de botón (44px) — no barras genéricas de 38px. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
                <SkeletonText width={130} height={13} style={{ marginBottom: 12 }} />
                <Skeleton width="100%" height={44} radius={10} delay={20} style={{ marginBottom: 8 }} />
                <Skeleton width="100%" height={44} radius={10} delay={40} />
              </div>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
                <SkeletonText width={70} height={13} style={{ marginBottom: 12 }} />
                <SkeletonText width="60%" height={13} delay={20} style={{ marginBottom: 6 }} />
                <SkeletonText width="80%" height={12} delay={40} style={{ marginBottom: 4 }} />
                <SkeletonText width="50%" height={12} delay={60} />
              </div>
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
                <SkeletonText width={150} height={13} style={{ marginBottom: 12 }} />
                <SkeletonText width="90%" height={11} delay={20} style={{ marginBottom: 14 }} />
                <Skeleton width="100%" height={44} radius={10} delay={40} style={{ marginBottom: 8 }} />
                <Skeleton width="100%" height={44} radius={10} delay={60} />
              </div>
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
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>No pudimos mostrar este pedido</div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 20 }}>{errorCarga || 'Pedido no encontrado.'}</div>
          <button onClick={() => router.push(base)} style={{ height: 44, padding: '0 20px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Volver a la tienda
          </button>
        </div>
      </div>
    )
  }

  const cancelado = pedido.status === 'CANCELLED'
  const fechaDe: Record<string, string> = {}
  for (const h of pedido.statusHistory) if (!fechaDe[h.status]) fechaDe[h.status] = h.createdAt

  // Si se canceló, el punto de referencia para pintar el avance es el
  // último estado real que alcanzó ANTES de cancelarse (nunca CANCELLED,
  // que no forma parte de la línea de tiempo de 5 pasos).
  const historialSinCancelar = pedido.statusHistory.filter(h => h.status !== 'CANCELLED')
  const ultimoAlcanzado = historialSinCancelar[historialSinCancelar.length - 1]?.status ?? 'PENDING'
  const currentIdx = PASOS.findIndex(p => p.status === (cancelado ? ultimoAlcanzado : pedido.status))

  const badge = ESTADO_UI[pedido.status] ?? { label: pedido.status, bg: 'var(--color-surface)', color: 'var(--color-muted)' }
  // El backend ya ordena por fecha desc — el primero es la más reciente.
  const ultimaCancelacion = pedido.cancellationRequests[0] ?? null
  const cancelacionPendiente = ultimaCancelacion?.status === 'PENDING'
  // PENDING sigue autocancelándose directo; Confirmado/En preparación pasan
  // a PEDIR la cancelación (el negocio la acepta o rechaza) — nunca con una
  // solicitud ya sin resolver de por medio.
  const puedeCancelar = (pedido.status === 'PENDING' || pedido.status === 'CONFIRMED' || pedido.status === 'PREPARING') && !cancelacionPendiente
  // El backend ya ordena por fecha desc — el primero es la más reciente.
  const ultimaDevolucion = pedido.returns[0] ?? null
  // Mismo criterio que usa el backend para "returnable" en el wizard del
  // panel (orders.service.ts, findAll con returnable=true): lo que ya se
  // pidió devolver (sin contar las rechazadas, que no devolvieron nada)
  // cuenta contra el total de unidades del pedido — no importa si esa
  // devolución sigue pendiente o ya se aprobó, en los dos casos ese
  // producto ya está "en trámite" o ya volvió. Si cubre todo el pedido,
  // no queda nada más para devolver.
  const totalUnidades = pedido.items.reduce((acc, it) => acc + it.quantity, 0)
  const unidadesEnTramite = pedido.returns
    .filter(r => r.status !== 'REJECTED')
    .reduce((acc, r) => acc + r.quantity, 0)
  const puedeDevolver = pedido.status === 'DELIVERED' && unidadesEnTramite < totalUnidades

  const direccion = pedido.onlineOrderDetails?.shippingAddress

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <StorefrontHeader tienda={tienda} logoUrl={config?.appearance?.logoUrl} headerLinks={config?.appearance?.headerLinks} showSearch={config?.appearance?.showSearch ?? true} />

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
          { label: 'Mi cuenta', href: `${base}/perfil` },
          { label: `Pedido #${pedido.orderNumber}` },
        ]} />

        <div className="sf-seg-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Encabezado pedido */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>#{pedido.orderNumber}</div>
                <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 2 }}>
                  {new Date(pedido.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                height: 28, padding: '0 14px', borderRadius: 999,
                background: badge.bg, color: badge.color,
                fontSize: 12, fontWeight: 700,
              }}>
                {badge.label}
              </span>
            </div>

            {cancelado && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12,
                background: 'var(--color-error-bg)', border: '1px solid rgba(220,38,38,0.25)',
              }}>
                <XIcon size={20} color="var(--color-error)" strokeWidth={1.5} style={{ flexShrink: 0 }} />
                <div style={{ fontSize: 13, color: 'var(--color-body)', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--color-error)' }}>Este pedido fue cancelado</strong>
                  {fechaDe.CANCELLED && <> el {fechaCorta(fechaDe.CANCELLED)}</>}.
                  {' '}Si tenés dudas, escribinos por WhatsApp.
                </div>
              </div>
            )}

            {/* Devolución — antes de esto, pedir una devolución no dejaba
                ningún rastro visible acá: la pantalla quedaba exactamente
                igual, como si el pedido nunca la hubiera recibido. Cuando ya
                está APROBADA se destaca más (borde más grueso + el monto
                bien visible, no solo texto) — es la que más le importa al
                cliente saber, es plata a favor de verdad. */}
            {ultimaDevolucion && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12,
                background: DEVOLUCION_UI[ultimaDevolucion.status].bg,
                border: `${ultimaDevolucion.status === 'APPROVED' ? 2 : 1}px solid ${DEVOLUCION_UI[ultimaDevolucion.status].color}${ultimaDevolucion.status === 'APPROVED' ? '' : '40'}`,
              }}>
                <RotateCcw size={20} color={DEVOLUCION_UI[ultimaDevolucion.status].color} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                <div style={{ fontSize: 13, color: 'var(--color-body)', lineHeight: 1.5, flex: 1 }}>
                  <strong style={{ color: DEVOLUCION_UI[ultimaDevolucion.status].color }}>{DEVOLUCION_UI[ultimaDevolucion.status].label}</strong>
                  {ultimaDevolucion.status === 'PENDING' && '. Te avisamos por email en cuanto la tienda la resuelva.'}
                  {ultimaDevolucion.status === 'APPROVED' && (
                    ultimaDevolucion.refundMethod === 'CREDIT_NOTE'
                      ? <>. Se emitió una nota de crédito de <strong>{fmt(ultimaDevolucion.amount)}</strong> a tu favor — revisá tu email, y la vas a poder usar en tu próxima compra.</>
                      : <>. Se te reembolsan <strong>{fmt(ultimaDevolucion.amount)}</strong> — la tienda te contacta para coordinar cómo.</>
                  )}
                  {ultimaDevolucion.status === 'REJECTED' && '. Si tenés dudas, escribinos por WhatsApp.'}
                </div>
                {ultimaDevolucion.status === 'APPROVED' && ultimaDevolucion.refundMethod === 'CREDIT_NOTE' && (
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: DEVOLUCION_UI[ultimaDevolucion.status].color, fontFamily: '"Geist Mono", monospace' }}>{fmt(ultimaDevolucion.amount)}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-subtle)' }}>a favor</div>
                  </div>
                )}
              </div>
            )}

            {/* Cancelación pedida — antes de esto, pedir cancelar un pedido
                ya confirmado no dejaba ningún rastro visible acá. */}
            {ultimaCancelacion && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: 16, borderRadius: 12,
                background: CANCELACION_UI[ultimaCancelacion.status].bg,
                border: `1px solid ${CANCELACION_UI[ultimaCancelacion.status].color}40`,
              }}>
                <XIcon size={20} color={CANCELACION_UI[ultimaCancelacion.status].color} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                <div style={{ fontSize: 13, color: 'var(--color-body)', lineHeight: 1.5, flex: 1 }}>
                  <strong style={{ color: CANCELACION_UI[ultimaCancelacion.status].color }}>{CANCELACION_UI[ultimaCancelacion.status].label}</strong>
                  {ultimaCancelacion.status === 'PENDING' && '. Te avisamos por email en cuanto la tienda la resuelva.'}
                  {ultimaCancelacion.status === 'APPROVED' && (
                    ultimaCancelacion.refundStatus === 'REFUNDED'
                      ? '. Ya se reembolsó el pago a tu cuenta de Mercado Pago.'
                      : ultimaCancelacion.refundStatus === 'FAILED'
                        ? '. Hubo un problema reembolsando el pago automáticamente — la tienda te contacta para resolverlo.'
                        : '. El pedido quedó cancelado.'
                  )}
                  {ultimaCancelacion.status === 'REJECTED' && '. Si tenés dudas, escribinos por WhatsApp.'}
                </div>
              </div>
            )}

            {/* Estado del pedido */}
            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 24px' }}>Estado del pedido</h3>

              <div style={{ position: 'relative' }}>
                {PASOS.map((paso, i) => {
                  const isDone   = i <= currentIdx
                  const isActive = i === currentIdx && !cancelado && pedido.status !== 'DELIVERED'
                  const fecha    = fechaDe[paso.status]
                  return (
                    <div key={paso.status} style={{ display: 'flex', gap: 16, position: 'relative', paddingBottom: i < PASOS.length - 1 ? 28 : 0 }}>
                      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: isDone ? 'var(--color-success)' : isActive ? 'var(--color-primary)' : 'var(--color-surface)',
                          border: `2px solid ${isDone ? 'var(--color-success)' : isActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                          color: '#fff', display: 'grid', placeItems: 'center', zIndex: 2, flexShrink: 0,
                        }}>
                          {isDone ? <Check size={14} strokeWidth={2.5} /> : isActive ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} /> : null}
                        </div>
                        {i < PASOS.length - 1 && (
                          <div style={{
                            position: 'absolute', top: 28, bottom: -28, left: '50%',
                            width: 2, transform: 'translateX(-50%)',
                            background: isDone && i < currentIdx ? 'var(--color-success)' : 'var(--color-border)',
                          }} />
                        )}
                      </div>
                      <div style={{ flex: 1, paddingTop: 4 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: (isDone || isActive) ? 'var(--color-text)' : 'var(--color-muted)' }}>
                          {paso.label}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-subtle)', marginTop: 2, fontFamily: '"Geist Mono", monospace' }}>
                          {/* Un paso salteado por el negocio queda hecho pero sin fecha propia: se muestra "—", no "Pendiente". */}
                          {fecha ? fechaCorta(fecha) : (isDone || cancelado) ? '—' : 'Pendiente'}
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
              {pedido.items.map((it, i) => (
                <div key={it.id} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 0', borderBottom: i < pedido.items.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <ProdImage hue={hueDeItem(it.id)} imgUrl={it.imgUrl} height={64} radius={8} style={{ width: 64, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>{it.productName}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
                      {it.variantLabel ? `${it.variantLabel} · ` : ''}x{it.quantity}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>
                    {fmt(it.unitPrice * it.quantity)}
                  </div>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 8, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>Total</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmt(pedido.total)}</span>
              </div>
            </div>

            {/* Acciones del pedido */}
            {(puedeCancelar || puedeDevolver) && (
              <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 14px' }}>Acciones del pedido</h3>
                {[
                  ...(puedeDevolver ? [{ Icon: RotateCcw, label: 'Iniciar devolución', href: `${base}/pedido/${id}/devolucion`, color: 'var(--color-body)' }] : []),
                  ...(puedeCancelar ? [{ Icon: X, label: 'Cancelar pedido', href: `${base}/pedido/${id}/cancelar`, color: 'var(--color-error)' }] : []),
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
            )}
          </div>

          {/* Sidebar derecho */}
          <div className="sf-seg-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <SideCard title="Contacto con la tienda">
              {tienda.wpp && (
                <button
                  onClick={() => openWpp(tienda.wpp, `Hola! Tengo una consulta sobre mi pedido #${pedido.orderNumber}`)}
                  style={{
                    width: '100%', height: 44, borderRadius: 10,
                    background: '#25D366', color: '#fff',
                    fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8,
                  }}
                >
                  <MessageCircle size={16} strokeWidth={1.5} /> WhatsApp
                </button>
              )}
              {tienda.email && (
                <a
                  href={`mailto:${tienda.email}`}
                  style={{
                    width: '100%', height: 44, borderRadius: 10,
                    background: 'transparent', color: 'var(--color-text)',
                    border: '1px solid var(--color-border)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none',
                  }}
                >
                  <Mail size={16} strokeWidth={1.5} /> Email
                </a>
              )}
            </SideCard>

            {pedido.onlineOrderDetails && (
              <SideCard title="Entrega">
                <div style={{ fontSize: 13, color: 'var(--color-body)', lineHeight: 1.55 }}>
                  <strong style={{ color: 'var(--color-text)' }}>{pedido.onlineOrderDetails.buyerName}</strong><br />
                  {direccion ? (
                    <>
                      {direccion.street}{direccion.floor ? `, Piso ${direccion.floor}` : ''}{direccion.depto ? ` ${direccion.depto}` : ''}<br />
                      {direccion.city}{direccion.provincia ? `, ${direccion.provincia}` : ''}{direccion.zip ? ` · ${direccion.zip}` : ''}
                    </>
                  ) : (
                    <span style={{ color: 'var(--color-muted)' }}>Retiro en el local o sin dirección de envío cargada.</span>
                  )}
                </div>
                {tienda.wpp && (
                  <button
                    onClick={() => openWpp(tienda.wpp, `Hola! Quería consultar sobre la entrega del pedido #${pedido.orderNumber}`)}
                    style={{
                      marginTop: 12, fontSize: 13, color: 'var(--color-success)', fontWeight: 500,
                      background: 'none', border: 'none', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <MessageCircle size={13} strokeWidth={1.5} /> Coordinar por WhatsApp →
                  </button>
                )}

                {/* Transportista + código — el dueño lo carga a mano desde
                    el panel (no hay integración con ningún correo), así que
                    solo aparece si ya lo cargó. */}
                {pedido.onlineOrderDetails.tracking && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                      {pedido.onlineOrderDetails.carrier ? CARRIER_LABEL[pedido.onlineOrderDetails.carrier] : 'Transportista'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace', wordBreak: 'break-all', flex: 1 }}>
                        {pedido.onlineOrderDetails.tracking}
                      </div>
                      <button
                        type="button"
                        onClick={() => copiarTracking(pedido.onlineOrderDetails!.tracking!)}
                        title="Copiar código"
                        style={{
                          flexShrink: 0, width: 30, height: 30, borderRadius: 8,
                          background: trackingCopiado ? 'var(--color-success-bg, #DCFCE7)' : 'var(--color-bg)',
                          border: '1px solid var(--color-border)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: trackingCopiado ? 'var(--color-success, #16A34A)' : 'var(--color-muted)',
                        }}
                      >
                        {trackingCopiado ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={1.5} />}
                      </button>
                    </div>
                    {pedido.onlineOrderDetails.carrier && CARRIER_TRACKING_URL[pedido.onlineOrderDetails.carrier] && (
                      <a
                        href={CARRIER_TRACKING_URL[pedido.onlineOrderDetails.carrier]}
                        target="_blank" rel="noreferrer"
                        style={{
                          width: '100%', height: 40, borderRadius: 10,
                          background: 'var(--color-primary-bg)', color: 'var(--color-primary)',
                          fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          textDecoration: 'none', boxSizing: 'border-box',
                        }}
                      >
                        <Truck size={14} strokeWidth={1.5} /> Seguir mi envío
                      </a>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--color-subtle)', marginTop: 8, lineHeight: 1.4 }}>
                      {trackingCopiado
                        ? 'Código copiado — pegalo en el buscador de la página del transportista.'
                        : 'Tocá el botón de copiar y pegá el código en el buscador de la página del transportista.'}
                    </div>
                  </div>
                )}
              </SideCard>
            )}

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

      <StorefrontFooter tienda={tienda} slug={slug} logoUrl={config?.appearance?.logoUrl} contact={config?.contact} showSocial={config?.appearance?.showSocialFooter ?? true} visible={config?.appearance?.showFooter ?? true} />
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
