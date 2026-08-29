import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { CheckCircle, Check, Clock, ArrowRight, MessageCircle } from 'lucide-react'
import { CheckoutStepper } from '@/components/storefront/CheckoutStepper'
import { ProdImage } from '@/components/storefront/Thumb'
import { Skeleton, SkeletonCircle, SkeletonText } from '@/design-system/components/Skeleton'
import { fmt, openWpp } from '@/lib/storefront/utils'
import { useAuth } from '@/hooks/useAuth'
import { getStorefrontConfig, toTiendaConfig, getOrderTracking, type StorefrontConfigResponse } from '@/lib/storefront/api'
import { meGetOrder, syncMercadopagoPayment, ApiError, type MeOrderDetail } from '@/lib/api'

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
  const { slug, pedido: pedidoId, email, metodo, payment_id: mpPaymentId } = router.query as { slug: string; pedido?: string; email?: string; metodo?: string; payment_id?: string }
  const base = `/tienda/${slug}`
  const { status: authStatus } = useAuth()

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
  // Con sesión, exactamente el mismo camino de siempre (/me/orders/:id — "Mis
  // pedidos" lo ve igual). Sin sesión (guest checkout), el mismo pedido se
  // pide por el endpoint público de tracking, mandando el email que viaja en
  // la URL (lo pusieron ahí CheckoutPago.tsx o el back_url de Mercado Pago).
  //
  // Mientras el pedido siga PENDING, se vuelve a pedir cada 4s (hasta un
  // límite): con Mercado Pago, `auto_return` trae de vuelta al comprador ACÁ
  // apenas MP aprueba el pago, pero el webhook que confirma el pedido de
  // verdad (y descuenta el stock) es una request aparte, async, que puede
  // llegar bastante después (medido en producción: hasta 1-2 minutos, a
  // veces más) — sin este sondeo, esta pantalla se quedaba mostrando
  // "Pendiente" para siempre aunque el pago ya hubiera salido bien, hasta
  // que el comprador recargara a mano.
  const MAX_INTENTOS_SONDEO = 30 // ~2 min a 4s cada uno — de sobra para el webhook
  useEffect(() => {
    if (!pedidoId || !slug || authStatus === 'loading') return
    let cancelado = false
    let intervalId: ReturnType<typeof setInterval> | null = null
    let intentos = 0

    function pedir() {
      const promesa = authStatus === 'authenticated' ? meGetOrder(pedidoId!) : getOrderTracking(slug, pedidoId!, email)
      return promesa
        .then(p => {
          if (cancelado) return
          setPedido(p)
          intentos += 1
          if ((p.status !== 'PENDING' || intentos >= MAX_INTENTOS_SONDEO) && intervalId) {
            clearInterval(intervalId)
            intervalId = null
          }
        })
        .catch(err => { if (!cancelado) setErrorCarga(err instanceof ApiError ? err.message : 'No se pudo cargar el pedido') })
        .finally(() => { if (!cancelado) setCargando(false) })
    }

    // La URL a la que MP redirige de vuelta ya trae `payment_id` en la
    // query — en vez de esperar pasivamente el webhook async (que puede
    // tardar bastante), se dispara la misma confirmación de una apenas se
    // vuelve del pago. Si falla (red, MP caído, lo que sea), el sondeo de
    // abajo sigue andando igual como red de seguridad — nunca bloquea nada.
    const arranque = mpPaymentId
      ? syncMercadopagoPayment(pedidoId, mpPaymentId).catch(() => {})
      : Promise.resolve()

    arranque.then(() => { if (!cancelado) { pedir(); intervalId = setInterval(() => { void pedir() }, 4000) } })

    return () => { cancelado = true; if (intervalId) clearInterval(intervalId) }
  }, [pedidoId, slug, authStatus, email, mpPaymentId])

  if (cargando || authStatus === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 50, height: 60, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', padding: '0 32px', display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {config?.appearance?.logoUrl
              ? <img src={config.appearance.logoUrl} alt={tienda.nombre} style={{ width: 26, height: 26, borderRadius: 7, objectFit: 'cover' }} />
              : <div style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg, #2563EB, #3B82F6)' }} />}
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{tienda.nombre}</span>
          </div>
        </header>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px 64px' }} aria-hidden="true">
          <CheckoutStepper step={3} />
          <div style={{ textAlign: 'center', maxWidth: 540, margin: '0 auto' }}>
            <SkeletonCircle size={88} style={{ margin: '0 auto 20px' }} />
            <SkeletonText width={280} height={26} delay={40} style={{ margin: '0 auto 14px', borderRadius: 6 }} />
            <SkeletonText width={360} height={12} delay={70} style={{ margin: '0 auto 28px' }} />
            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 14, padding: 24, textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--color-border)' }}>
                <SkeletonText width={90} height={20} delay={100} />
                <Skeleton width={80} height={22} radius={999} delay={130} />
              </div>
              {[1, 2].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
                  <Skeleton width={48} height={48} radius={8} delay={150 + i * 40} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <SkeletonText width="60%" height={11} delay={160 + i * 40} />
                    <SkeletonText width="30%" height={10} delay={180 + i * 40} />
                  </div>
                </div>
              ))}
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
          <button className="ds-hover" onClick={() => router.push(base)} style={{ height: 44, padding: '0 20px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
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
  // Con Mercado Pago la confirmación la dispara SOLA el webhook de pago
  // aprobado — nunca una persona del negocio. Mostrar "en cuanto el negocio
  // confirme el pago" ahí es literalmente falso y generaba la duda de "¿por
  // qué tengo que esperar a que alguien confirme si ya pagué?". El resto de
  // los métodos (efectivo/retiro) sí esperan una confirmación manual real, y
  // ahí el mensaje original sigue siendo correcto.
  const esMercadoPago = pedido.payments.some(p => p.method === 'MERCADOPAGO')
  // Transferencia es un caso aparte de "esperar a que el negocio confirme":
  // acá el que tiene que actuar primero es el COMPRADOR (mandar el
  // comprobante) — el mensaje genérico ("en cuanto el negocio confirme")
  // sonaba a que había que quedarse esperando sin hacer nada, cuando en
  // realidad el paso que falta es del lado del comprador. Se avisan las dos
  // vías (mandarlo él, o que el negocio se lo pida) para que no quede la
  // duda de qué pasa si no lo manda apenas termina la compra.
  //
  // OJO: no se puede detectar mirando `pedido.payments` (a diferencia de
  // Mercado Pago) — ese array solo se llena cuando se registra un pago de
  // verdad (el webhook de MP, o el negocio a mano después — ver el 400 "Los
  // pagos se registran al confirmar el pago online" en
  // OrdersService.create()), así que con Transferencia llega SIEMPRE vacío
  // en este punto, recién creado el pedido — probado en vivo, se quedaba
  // mostrando el mensaje genérico siempre. Por eso viaja como query param
  // desde CheckoutPago.tsx (`metodo`, el mismo que eligió el comprador),
  // no reconstruido acá.
  const esTransferencia = metodo === 'TRANSFER'
  // Igual que Transferencia: no se puede detectar mirando `pedido.payments`
  // (llega vacío recién creado el pedido) — viaja como query param desde
  // CheckoutPago.tsx. Acá no hay nada que el comprador tenga que hacer
  // (ni transferir ni mandar comprobante) — el negocio es quien se contacta.
  const esCoordinarDespues = metodo === 'COORDINATE_LATER'

  // Transferencia pendiente es una pantalla aparte, no una variante de la
  // genérica de abajo: este método ("Coordinar por WhatsApp", antes
  // Transferencia) ya no muestra CBU/alias — el negocio se comunica por
  // WhatsApp para coordinar cómo pagar, así que acá no hay ningún dato
  // bancario que mostrar. Se pidió explícitamente que se vea como un pedido
  // registrado con éxito (tilde verde), no como un estado de espera
  // ambiguo — el pedido SÍ se registró bien, solo falta que el negocio se
  // contacte.
  if (pendiente && esTransferencia) {
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
          <a className="ds-hover" href={base} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', padding: '4px 8px', margin: '-4px -8px', borderRadius: 8 }}>
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
          <div style={{ textAlign: 'center', maxWidth: 460, margin: '0 auto' }}>
            <div style={{
              width: 88, height: 88, borderRadius: '50%',
              background: 'var(--color-success-bg)', border: '2px solid var(--color-success)',
              display: 'grid', placeItems: 'center', margin: '0 auto 20px', color: 'var(--color-success)',
            }}>
              <CheckCircle size={44} strokeWidth={1.5} />
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 12px' }}>
              ¡Pedido registrado!
            </h1>
            <p style={{ fontSize: 15, color: 'var(--color-muted)', marginBottom: 28, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
              Tu pedido <strong style={{ color: 'var(--color-text)' }}>#{pedido.orderNumber}</strong> fue recibido correctamente. No hace falta que pagues ahora — el negocio te va a escribir por WhatsApp para coordinar cómo pagás.
            </p>

            {tienda.wpp && (
              <button
                className="ds-hover"
                onClick={() => openWpp(tienda.wpp, `Hola! Quería coordinar el pago de mi pedido #${pedido.orderNumber}.`)}
                style={{
                  width: '100%', height: 52, borderRadius: 12,
                  background: '#25D366', color: '#fff', border: 'none', cursor: 'pointer',
                  fontSize: 15, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 16px rgba(37,211,102,0.30)',
                }}
              >
                <MessageCircle size={18} strokeWidth={1.8} /> Escribirnos por WhatsApp
              </button>
            )}
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 14, lineHeight: 1.5 }}>
              Si preferís esperar, no hay problema — te vamos a contactar nosotros para coordinar el pago. Tu pedido ya quedó registrado.
            </div>

            <div style={{ marginTop: 18 }}>
              <button
                className="ds-link"
                onClick={() => router.push(authStatus === 'authenticated' ? `${base}/pedido/${pedido.id}` : base)}
                style={{
                  background: 'none', border: 'none', color: 'var(--color-primary)',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                {authStatus === 'authenticated' ? <>Ya lo envié, ver mi pedido <ArrowRight size={15} strokeWidth={2} /></> : 'Seguir comprando'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Coordinar después pendiente es también una pantalla aparte: no hay
  // ningún dato de pago que mostrar (ni CBU/alias ni "enviá el comprobante")
  // — el único paso siguiente es que el negocio se contacte, así que el
  // texto y el botón de WhatsApp apuntan a eso, no a un comprobante.
  if (pendiente && esCoordinarDespues) {
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
          <a className="ds-hover" href={base} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', padding: '4px 8px', margin: '-4px -8px', borderRadius: 8 }}>
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
          <div style={{ textAlign: 'center', maxWidth: 460, margin: '0 auto' }}>
            <div style={{
              width: 88, height: 88, borderRadius: '50%',
              background: 'var(--color-success-bg)', border: '2px solid var(--color-success)',
              display: 'grid', placeItems: 'center', margin: '0 auto 20px', color: 'var(--color-success)',
            }}>
              <CheckCircle size={44} strokeWidth={1.5} />
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 12px' }}>
              ¡Pedido registrado!
            </h1>
            <p style={{ fontSize: 15, color: 'var(--color-muted)', marginBottom: 28, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>
              Tu pedido <strong style={{ color: 'var(--color-text)' }}>#{pedido.orderNumber}</strong> fue recibido correctamente. No hace falta que pagues ahora — nos vamos a comunicar con vos para coordinar el pago.
            </p>

            {tienda.wpp && (
              <button
                className="ds-hover"
                onClick={() => openWpp(tienda.wpp, `Hola! Quería coordinar el pago de mi pedido #${pedido.orderNumber}.`)}
                style={{
                  width: '100%', height: 52, borderRadius: 12,
                  background: '#25D366', color: '#fff', border: 'none', cursor: 'pointer',
                  fontSize: 15, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 16px rgba(37,211,102,0.30)',
                }}
              >
                <MessageCircle size={18} strokeWidth={1.8} /> Escribirnos por WhatsApp
              </button>
            )}
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 14, lineHeight: 1.5 }}>
              Si preferís esperar, no hay problema — te vamos a contactar nosotros para coordinar cómo pagás. Tu pedido ya quedó registrado.
            </div>

            <div style={{ marginTop: 18 }}>
              <button
                className="ds-link"
                onClick={() => router.push(authStatus === 'authenticated' ? `${base}/pedido/${pedido.id}` : base)}
                style={{
                  background: 'none', border: 'none', color: 'var(--color-primary)',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                {authStatus === 'authenticated' ? <>Ver mi pedido <ArrowRight size={15} strokeWidth={2} /></> : 'Seguir comprando'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

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
        <a className="ds-hover" href={base} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', padding: '4px 8px', margin: '-4px -8px', borderRadius: 8 }}>
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
              ? esMercadoPago
                ? <>Gracias{nombreComprador ? `, ${nombreComprador}` : ''}. Estamos confirmando tu pago con Mercado Pago — esto puede tardar unos segundos, no hace falta que hagas nada más.</>
                : <>Gracias{nombreComprador ? `, ${nombreComprador}` : ''}. Tu pedido fue recibido — en cuanto el negocio confirme el pago te avisamos por WhatsApp.</>
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
                <ProdImage hue={hueDeItem(it.id)} imgUrl={it.imgUrl} height={48} radius={8} style={{ width: 48, flexShrink: 0 }} />
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
              {pedido.onlineOrderDetails?.shippingCost != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, color: 'var(--color-body)' }}>
                  <span>Envío</span>
                  <span style={{ fontFamily: '"Geist Mono", monospace' }}>
                    {pedido.onlineOrderDetails.shippingCost === 0 ? 'Gratis' : fmt(pedido.onlineOrderDetails.shippingCost)}
                  </span>
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
                  {pendiente
                    ? esMercadoPago ? 'Confirmando el pago automáticamente…' : 'Te avisamos cuando confirmemos el pago'
                    : 'Te contactaremos por WhatsApp'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>También podés escribirnos directo:</div>
              </div>
              {tienda.wpp && (
                <button
                  className="ds-hover"
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
            <button className="ds-hover" onClick={() => router.push(base)} style={{
              height: 48, padding: '0 22px', borderRadius: 8,
              background: 'transparent', color: 'var(--color-text)',
              border: '1px solid var(--color-border)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              Seguir comprando
            </button>
            {/* Seguimiento.tsx/Comprobante.tsx asumen sesión — para un
                invitado, el comprobante completo ya está en esta misma
                pantalla (arriba), así que no hace falta el botón. Adaptar
                esas dos pantallas para invitados queda para después (el
                endpoint de tracking ya está listo para eso). */}
            {authStatus === 'authenticated' && (
              <button className="ds-hover" onClick={() => router.push(`${base}/pedido/${pedido.id}`)} style={{
                height: 48, padding: '0 22px', borderRadius: 8,
                background: 'var(--color-primary)', color: '#fff',
                fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: '0 4px 16px rgba(59,130,246,0.25)',
              }}>
                Ver mi pedido <ArrowRight size={16} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

