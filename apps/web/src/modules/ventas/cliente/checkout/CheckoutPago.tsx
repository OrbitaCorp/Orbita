import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import {
  Landmark, Lock, ChevronLeft, Store, Truck, Wallet, CheckCircle2, Clock, Tag, AlertTriangle,
  CreditCard, X, MapPin, Plus,
} from 'lucide-react'
import { CheckoutStepper } from '@/components/storefront/CheckoutStepper'
import { PageLoader } from '@/components/PageLoader'
import { ProdImage } from '@/components/storefront/Thumb'
import { Skeleton, SkeletonCircle, SkeletonText } from '@/design-system/components/Skeleton'
import { fmt } from '@/lib/storefront/utils'
import { useCart } from '@/lib/storefront/CartContext'
import { useAuth } from '@/hooks/useAuth'
import {
  getStorefrontConfig, toTiendaConfig, getStorefrontExclusiveDiscount, toCupon,
  StorefrontApiError, type StorefrontConfigResponse,
} from '@/lib/storefront/api'
import {
  checkoutStorefront, crearPreferenciaMercadopago, ApiError,
  meListAddresses, meCreateAddress, type MeAddress, type CheckoutInput,
} from '@/lib/api'
import { loadCheckoutDraft, clearCheckoutDraft } from '@/lib/storefront/checkoutDraft'

type Metodo = 'CASH' | 'TRANSFER' | 'MERCADOPAGO'
type Entrega = 'DELIVERY' | 'PICKUP'

const METODO_META: Record<Metodo, { Icon: React.ElementType; titulo: string; desc: string }> = {
  MERCADOPAGO: { Icon: CreditCard, titulo: 'Mercado Pago', desc: 'Tarjeta, débito o dinero en cuenta' },
  CASH:        { Icon: Wallet,     titulo: 'Efectivo',        desc: 'Pagás al recibir o al retirar' },
  TRANSFER:    { Icon: Landmark,   titulo: 'Transferencia',   desc: 'Coordinás el comprobante por WhatsApp' },
}
// 'Retiro en local' dejó de ser un método de pago — ahora es una forma de
// entrega (Entrega), independiente de cómo se paga (ver checkout.dto.ts).
const ENTREGA_META: Record<Entrega, { Icon: React.ElementType; titulo: string; desc: string }> = {
  DELIVERY: { Icon: Truck, titulo: 'Envío a domicilio', desc: 'El costo se coordina por WhatsApp' },
  PICKUP:   { Icon: Store, titulo: 'Retiro en local',    desc: 'Reservamos el stock, retirás cuando quieras' },
}

export default function CheckoutPago() {
  const router  = useRouter()
  const { slug } = router.query as { slug: string }
  const base = `/tienda/${slug}`
  const { items, subtotal, vaciar, cuponAplicado, aplicarCupon, quitarCupon, cuponError, descuentoTicket } = useCart()
  const { user, status: authStatus } = useAuth()
  const cliente = user?.type === 'customer' ? user.customer : null

  const [config, setConfig] = useState<StorefrontConfigResponse | null>(null)
  useEffect(() => {
    if (!slug) return
    let cancelado = false
    getStorefrontConfig(slug).then(cfg => { if (!cancelado) setConfig(cfg) }).catch(() => {})
    return () => { cancelado = true }
  }, [slug])
  const tienda = config ? toTiendaConfig(config) : { nombre: '', sub: '', slug: slug ?? '', dominio: '', wpp: '', email: '' }

  const [enviando, setEnviando] = useState(false)
  // Se prende justo antes de pedir la preferencia de Mercado Pago y se
  // mantiene hasta el `window.location.href` real — cubre el hueco async
  // entre "click en Confirmar" y el salto de verdad a MP, mostrando el
  // loader de Órbita en vez de dejar ver la pantalla de abajo (ver más abajo).
  const [redirigiendoMP, setRedirigiendoMP] = useState(false)

  // `!enviando`: confirmar() vacía el carrito (vaciar()) ANTES de terminar
  // de armar la preferencia de pago o de navegar a la confirmación — sin
  // este freno, ese instante con items.length === 0 alcanzaba a disparar
  // este mismo efecto y mandaba al comprador a "Tu carrito está vacío" un
  // parpadeo antes de llegar a Mercado Pago o a la confirmación real.
  useEffect(() => {
    if (slug && items.length === 0 && !enviando) router.replace(`${base}/carrito`)
  }, [slug, items.length, enviando]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sin datos del paso 1 (nombre/email/teléfono), no hay a quién facturarle
  // el pedido — se vuelve a pedirlos en vez de mandar algo incompleto. No
  // alcanza con que el draft EXISTA: uno viejo (de antes de que el paso 1
  // validara estos campos obligatorios) podía tener el objeto pero con
  // campos vacíos, y esta pantalla lo dejaba pasar igual.
  const draft = useMemo(() => (slug ? loadCheckoutDraft(slug) : null), [slug])
  const draftCompleto = !!draft?.buyer?.name?.trim() && !!draft?.buyer?.email?.trim() && !!draft?.buyer?.phone?.trim()
  useEffect(() => {
    if (slug && !draftCompleto) router.replace(`${base}/checkout/datos`)
  }, [slug, draftCompleto]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Envío a domicilio vs. retiro en local — se elige ACÁ, antes del medio
  // de pago (antes 'PICKUP' vivía mezclado como si fuera un método de pago
  // más). Retiro se oculta si el negocio no lo activó en Configuración;
  // envío a domicilio siempre está disponible (no hay un toggle para eso).
  const entregasDisponibles = useMemo<Entrega[]>(() => {
    if (!config) return []
    return (['DELIVERY', 'PICKUP'] as Entrega[]).filter(e => e === 'PICKUP' ? config.payment?.acceptsPickup : true)
  }, [config])
  const [envio, setEnvio] = useState<Entrega | null>(null)
  useEffect(() => {
    if (!envio && entregasDisponibles.length > 0) setEnvio(entregasDisponibles[0])
  }, [entregasDisponibles, envio])

  // ── Dirección de envío — dos caminos: cliente con sesión elige entre sus
  // direcciones guardadas (mismo mecanismo que antes vivía en
  // CheckoutDatos.tsx, movido acá); un invitado la tipea a mano, sin
  // guardar nada (no hay Customer al que colgarle una fila de Address).
  const [direcciones, setDirecciones] = useState<MeAddress[]>([])
  const [dirSel, setDirSel]           = useState<string | null>(null)
  const [showNewDir, setShowNewDir]   = useState(false)
  const [guardandoDir, setGuardandoDir] = useState(false)
  const [errorDir, setErrorDir]       = useState('')
  const [nueva, setNueva] = useState({ alias: '', street: '', floor: '', depto: '', provincia: '', city: '', zip: '' })
  useEffect(() => {
    if (!cliente || envio !== 'DELIVERY') return
    meListAddresses().then(list => {
      setDirecciones(list)
      const preferida = list.find(d => d.isDefault) ?? list[0]
      if (preferida) setDirSel(prev => prev ?? preferida.id)
    }).catch(() => {})
  }, [cliente, envio])

  async function agregarDireccion() {
    // Los 7 campos son obligatorios: quien despacha el pedido necesita la
    // dirección completa, no una a medias que después hay que perseguir por
    // WhatsApp.
    const faltaAlgun = (['alias', 'street', 'floor', 'depto', 'provincia', 'city', 'zip'] as const).some(k => !nueva[k].trim())
    if (faltaAlgun) { setErrorDir('Completá todos los campos de la dirección'); return }
    setGuardandoDir(true)
    setErrorDir('')
    try {
      const creada = await meCreateAddress({
        alias: nueva.alias.trim(),
        street: nueva.street.trim(),
        floor: nueva.floor.trim(),
        depto: nueva.depto.trim(),
        provincia: nueva.provincia.trim(),
        city: nueva.city.trim(),
        zip: nueva.zip.trim(),
      })
      setDirecciones(prev => [...prev, creada])
      setDirSel(creada.id)
      setShowNewDir(false)
      setNueva({ alias: '', street: '', floor: '', depto: '', provincia: '', city: '', zip: '' })
    } catch (err) {
      setErrorDir(err instanceof ApiError ? err.message : 'No se pudo guardar la dirección')
    } finally {
      setGuardandoDir(false)
    }
  }

  // Invitado: dirección tipeada a mano, se manda como texto plano
  // (CheckoutInput.shippingAddress) — nunca crea una fila de Address.
  const [dirInvitado, setDirInvitado] = useState({ street: '', floor: '', depto: '', referencia: '', provincia: '', city: '', zip: '' })
  const [errorDirInvitado, setErrorDirInvitado] = useState('')
  const direccionRef = useRef<HTMLInputElement>(null)
  const floorRef = useRef<HTMLInputElement>(null)
  const deptoRef = useRef<HTMLInputElement>(null)
  const referenciaRef = useRef<HTMLInputElement>(null)
  const provinciaRef = useRef<HTMLInputElement>(null)
  const ciudadRef = useRef<HTMLInputElement>(null)
  const zipRef = useRef<HTMLInputElement>(null)
  const dirInvitadoRefs = { street: direccionRef, floor: floorRef, depto: deptoRef, referencia: referenciaRef, provincia: provinciaRef, city: ciudadRef, zip: zipRef }

  // Métodos que el negocio activó de verdad en Configuración — Mercado Pago
  // exige además la conexión OAuth real (mercadopagoAvailable), no solo el
  // toggle: un negocio puede tener el toggle prendido sin haber conectado
  // todavía su cuenta. Efectivo, además, solo tiene sentido con retiro en
  // local — con envío a domicilio no hay a quién pagarle en mano.
  const metodosDisponibles = useMemo<Metodo[]>(() => {
    const p = config?.payment
    if (!p) return []
    return (['MERCADOPAGO', 'CASH', 'TRANSFER'] as Metodo[]).filter(m => {
      if (m === 'CASH' && envio === 'DELIVERY') return false
      return m === 'MERCADOPAGO' ? p.mercadopagoAvailable : m === 'CASH' ? p.acceptsCash : p.acceptsTransfer
    })
  }, [config, envio])

  const [metodo, setMetodo] = useState<Metodo | null>(null)
  useEffect(() => {
    // Si el método elegido dejó de estar disponible (ej. Efectivo al
    // cambiar a envío a domicilio), se limpia para forzar a elegir de
    // nuevo — nunca se manda un método que ya no aparece en la lista.
    if (metodo && !metodosDisponibles.includes(metodo)) { setMetodo(null); return }
    if (!metodo && metodosDisponibles.length > 0) setMetodo(metodosDisponibles[0])
  }, [metodosDisponibles, metodo])

  const [error, setError] = useState('')

  // Código de cupón tipeado a mano acá en Pago — mismo mecanismo que
  // Carrito.tsx (comparten el cupón vía CartContext, así que uno aplicado
  // allá ya llega listo acá, chip incluido). Apenas se aplica, revalidar()
  // se dispara sola (reacciona al cambio de cupón) y trae el descuento REAL
  // contra este carrito — `cuponError` avisa acá mismo si no aplica, nunca
  // recién al confirmar la compra.
  const [codigoCupon, setCodigoCupon] = useState('')
  const [aplicandoCupon, setAplicandoCupon] = useState(false)
  const [errorAplicarCupon, setErrorAplicarCupon] = useState('')

  async function aplicarCodigoCupon() {
    const codigo = codigoCupon.trim()
    if (!codigo || !slug || aplicandoCupon) return
    setAplicandoCupon(true)
    setErrorAplicarCupon('')
    try {
      const c = await getStorefrontExclusiveDiscount(slug, codigo)
      aplicarCupon(toCupon(c))
      setCodigoCupon('')
    } catch (err) {
      setErrorAplicarCupon(err instanceof StorefrontApiError ? err.message : 'No se pudo aplicar el cupón')
    } finally {
      setAplicandoCupon(false)
    }
  }

  const descuentoEfectivo = metodo === 'CASH' && config?.payment?.cashDiscountPercent
    ? Math.round(subtotal * config.payment.cashDiscountPercent) / 100
    : 0
  // Descuento automático (RBT-613) de alcance TICKET — `subtotal` (de
  // useCart()) ya trae aplicados los descuentos POR PRODUCTO en cada ítem
  // (automáticos Y del cupón, si hay uno aplicado — ver CartContext); este
  // es aparte porque no tiene una sola línea donde reflejarse. Ya viene de la
  // última revalidación real contra el backend, no es una estimación.
  const montoDescuentoTicket = descuentoTicket?.monto ?? 0
  const total = Math.max(0, subtotal - descuentoEfectivo - montoDescuentoTicket)

  // Con envío a domicilio, hace falta una dirección resuelta: para un
  // cliente con sesión, una de sus direcciones guardadas elegida; para un
  // invitado, los 7 campos completos — todos obligatorios, así quien
  // despacha el pedido tiene la dirección entera y no tiene que perseguir
  // datos por WhatsApp.
  const direccionCompleta = envio !== 'DELIVERY'
    || (cliente ? !!dirSel : Object.values(dirInvitado).every(v => v.trim()))

  async function confirmar() {
    if (!draft || !draftCompleto || !envio || !metodo || enviando) return
    if (envio === 'DELIVERY' && !cliente && !direccionCompleta) {
      const faltante = (Object.entries(dirInvitadoRefs) as [keyof typeof dirInvitado, React.RefObject<HTMLInputElement>][])
        .find(([campo]) => !dirInvitado[campo].trim())
      setErrorDirInvitado('Completá todos los campos de la dirección')
      faltante?.[1].current?.focus()
      return
    }
    setEnviando(true)
    setError('')
    try {
      const payload: CheckoutInput = {
        items: items.map(it => ({ variantId: it.id, quantity: it.qty })),
        buyer: draft.buyer,
        shippingMethod: envio,
        shippingAddressId: envio === 'DELIVERY' && cliente ? (dirSel ?? undefined) : undefined,
        shippingAddress: envio === 'DELIVERY' && !cliente ? {
          street: dirInvitado.street.trim(),
          floor: dirInvitado.floor.trim(),
          depto: dirInvitado.depto.trim(),
          referencia: dirInvitado.referencia.trim(),
          provincia: dirInvitado.provincia.trim(),
          city: dirInvitado.city.trim(),
          zip: dirInvitado.zip.trim(),
        } : undefined,
        paymentMethod: metodo,
        couponCode: cuponAplicado?.codigo || undefined,
      }
      const pedido = await checkoutStorefront(slug, payload)
      // Sin sesión, Confirmacion.tsx necesita el email en la URL para poder
      // pedir el pedido por el endpoint público de tracking (no tiene con
      // qué autenticar el pedido si no). Se captura ACÁ, antes de limpiar el
      // draft — con sesión no hace falta (el backend ya sabe de quién es).
      const emailInvitado = authStatus === 'anonymous' ? draft.buyer.email : null
      const sufijoTracking = emailInvitado ? `&email=${encodeURIComponent(emailInvitado)}` : ''

      // El pedido ya existe (PENDING) más allá de lo que pase con el pago:
      // se limpia el carrito/draft acá, igual que con los demás métodos, en
      // vez de esperar a que MP confirme.
      vaciar()
      clearCheckoutDraft(slug)

      if (metodo === 'MERCADOPAGO') {
        // El pedido YA existe en este punto (PENDING) más allá de lo que
        // pase acá — si pedir la preferencia falla, no tiene sentido
        // mostrar un error y dejar al comprador sin saber que su pedido se
        // registró igual. Se manda a la confirmación (queda "Pendiente",
        // puede reintentar el pago o coordinarlo directo con el negocio).
        //
        // `redirigiendoMP` tapa con el loader de Órbita el hueco entre acá
        // y el `window.location.href` de abajo — antes, en ese hueco
        // (esperando la respuesta de crearPreferenciaMercadopago), el efecto
        // de "carrito vacío → volver a /carrito" de arriba ya se había
        // disparado (vaciar() corrió antes) y el comprador veía un
        // parpadeo de "Tu carrito está vacío" antes de llegar a MP.
        setRedirigiendoMP(true)
        try {
          // Navegación de página completa a propósito: el pago pasa en el
          // dominio de MP. Las tres back_urls (éxito/pendiente/rechazo)
          // vuelven a la MISMA pantalla de confirmación, que ya lee el
          // estado real del pedido — evita duplicar el pedido si el
          // comprador reintenta desde ahí. (Si es invitado, ese back_url ya
          // lleva el email — lo arma createOrderPreference() del backend.)
          const { initPoint } = await crearPreferenciaMercadopago(pedido.id)
          if (!initPoint) throw new Error('sin initPoint')
          window.location.href = initPoint
          return
        } catch {
          setRedirigiendoMP(false)
          router.push(`${base}/checkout/confirmacion?pedido=${pedido.id}${sufijoTracking}`)
          return
        }
      }
      router.push(`${base}/checkout/confirmacion?pedido=${pedido.id}${sufijoTracking}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo confirmar el pedido')
    } finally {
      setEnviando(false)
    }
  }

  // Sesión sin resolver todavía, o sin datos completos del paso 1
  // (redirigiendo a Datos) — un invitado (authStatus === 'anonymous') sí
  // llega a esta pantalla, comprar sin cuenta es un flujo válido.
  if (authStatus === 'loading' || !draftCompleto) {
    return <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }} />
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <PageLoader visible={redirigiendoMP} message="Redirigiendo a Mercado Pago…" />
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
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 16px' }}>¿Cómo lo recibís?</h2>

              {!config && (
                <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[0, 1].map(i => {
                    const d = i * 90
                    return (
                      <div key={i} style={{ padding: 16, borderRadius: 10, border: '2px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <SkeletonCircle size={20} delay={d} />
                        <Skeleton width={20} height={20} radius={6} delay={d + 30} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                          <SkeletonText width={i === 0 ? '42%' : '34%'} height={13} delay={d + 60} />
                          <SkeletonText width={i === 0 ? '58%' : '50%'} height={10} delay={d + 90} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {config && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {entregasDisponibles.map(id => {
                    const m = ENTREGA_META[id]
                    const active = envio === id
                    return (
                      <div
                        key={id}
                        onClick={() => setEnvio(id)}
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
                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{m.titulo}</div>
                            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>{m.desc}</div>
                          </div>
                        </div>

                        {/* ── Retiro en local: dirección real de la sucursal ── */}
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

                        {/* ── Envío a domicilio: aviso de costo + dirección ── */}
                        {active && id === 'DELIVERY' && (
                          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div style={{ padding: 14, borderRadius: 10, background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: 12.5, color: 'var(--color-body)', lineHeight: 1.5 }}>
                              El costo de envío no se cobra acá — te contactamos por WhatsApp después de confirmar el pedido para coordinarlo según tu ubicación.
                            </div>

                            {cliente ? (
                              <div>
                                {direcciones.length > 0 && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                                    {direcciones.map(d => {
                                      const activeDir = dirSel === d.id
                                      return (
                                        <label
                                          key={d.id}
                                          style={{
                                            display: 'flex', alignItems: 'center', gap: 14,
                                            padding: 16, borderRadius: 10, cursor: 'pointer',
                                            background: activeDir ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                                            border: `2px solid ${activeDir ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                          }}
                                        >
                                          <input type="radio" name="dir" checked={activeDir} onChange={() => setDirSel(d.id)} style={{ accentColor: 'var(--color-primary)' }} />
                                          <MapPin size={20} strokeWidth={1.5} color="var(--color-muted)" />
                                          <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{d.alias || 'Dirección'}</span>
                                              {d.isDefault && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-success)', background: 'var(--color-success-bg)', padding: '2px 8px', borderRadius: 999 }}>Predeterminada</span>}
                                            </div>
                                            <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 2 }}>
                                              {d.street}{d.floor ? ` · ${d.floor}` : ''} · {d.city}{d.zip ? ` · CP ${d.zip}` : ''}
                                            </div>
                                          </div>
                                        </label>
                                      )
                                    })}
                                  </div>
                                )}
                                <button type="button" onClick={() => setShowNewDir(v => !v)} style={{
                                  fontSize: 13, fontWeight: 500, color: 'var(--color-primary)',
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: 6,
                                }}>
                                  {showNewDir ? <X size={14} /> : <Plus size={14} />}
                                  {showNewDir ? 'Ocultar formulario' : 'Agregar nueva dirección'}
                                </button>

                                {showNewDir && (
                                  <div style={{ marginTop: 14 }}>
                                    <CampoDir label="Dirección" required style={{ marginBottom: 14 }}>
                                      <InputDir placeholder="Av. Corrientes 1234" value={nueva.street} onChange={v => setNueva(p => ({ ...p, street: v }))} icon={<MapPin size={15} strokeWidth={1.5} color="var(--color-subtle)" />} />
                                    </CampoDir>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                                      <CampoDir label="Piso" required><InputDir placeholder="5" value={nueva.floor} onChange={v => setNueva(p => ({ ...p, floor: v }))} /></CampoDir>
                                      <CampoDir label="Departamento" required><InputDir placeholder="B" value={nueva.depto} onChange={v => setNueva(p => ({ ...p, depto: v }))} /></CampoDir>
                                      <CampoDir label="Alias" required><InputDir placeholder="Casa" value={nueva.alias} onChange={v => setNueva(p => ({ ...p, alias: v }))} /></CampoDir>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 14 }}>
                                      <CampoDir label="Provincia" required><InputDir placeholder="CABA" value={nueva.provincia} onChange={v => setNueva(p => ({ ...p, provincia: v }))} /></CampoDir>
                                      <CampoDir label="Ciudad" required><InputDir placeholder="CABA" value={nueva.city} onChange={v => setNueva(p => ({ ...p, city: v }))} /></CampoDir>
                                      <CampoDir label="CP" required><InputDir placeholder="C1043" value={nueva.zip} onChange={v => setNueva(p => ({ ...p, zip: v }))} /></CampoDir>
                                    </div>
                                    {errorDir && <div style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 10 }}>{errorDir}</div>}
                                    <button type="button" onClick={() => void agregarDireccion()} disabled={guardandoDir} style={{
                                      marginTop: 14, height: 40, padding: '0 18px', borderRadius: 8,
                                      background: 'var(--color-text)', color: 'var(--color-bg)',
                                      fontSize: 13, fontWeight: 600, border: 'none', cursor: guardandoDir ? 'default' : 'pointer', opacity: guardandoDir ? 0.6 : 1,
                                    }}>
                                      {guardandoDir ? 'Guardando…' : 'Guardar dirección'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <CampoDir label="Dirección" required style={{ marginBottom: 14 }}>
                                  <InputDir ref={direccionRef} placeholder="Av. Corrientes 1234" value={dirInvitado.street} onChange={v => { setDirInvitado(p => ({ ...p, street: v })); if (errorDirInvitado) setErrorDirInvitado('') }} icon={<MapPin size={15} strokeWidth={1.5} color="var(--color-subtle)" />} />
                                </CampoDir>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
                                  <CampoDir label="Piso" required>
                                    <InputDir ref={floorRef} placeholder="5" value={dirInvitado.floor} onChange={v => { setDirInvitado(p => ({ ...p, floor: v })); if (errorDirInvitado) setErrorDirInvitado('') }} />
                                  </CampoDir>
                                  <CampoDir label="Departamento" required>
                                    <InputDir ref={deptoRef} placeholder="B" value={dirInvitado.depto} onChange={v => { setDirInvitado(p => ({ ...p, depto: v })); if (errorDirInvitado) setErrorDirInvitado('') }} />
                                  </CampoDir>
                                  <CampoDir label="Referencia" required>
                                    <InputDir ref={referenciaRef} placeholder="Portón negro" value={dirInvitado.referencia} onChange={v => { setDirInvitado(p => ({ ...p, referencia: v })); if (errorDirInvitado) setErrorDirInvitado('') }} />
                                  </CampoDir>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 14 }}>
                                  <CampoDir label="Provincia" required>
                                    <InputDir ref={provinciaRef} placeholder="CABA" value={dirInvitado.provincia} onChange={v => { setDirInvitado(p => ({ ...p, provincia: v })); if (errorDirInvitado) setErrorDirInvitado('') }} />
                                  </CampoDir>
                                  <CampoDir label="Ciudad" required>
                                    <InputDir ref={ciudadRef} placeholder="CABA" value={dirInvitado.city} onChange={v => { setDirInvitado(p => ({ ...p, city: v })); if (errorDirInvitado) setErrorDirInvitado('') }} />
                                  </CampoDir>
                                  <CampoDir label="CP" required>
                                    <InputDir ref={zipRef} placeholder="C1043" value={dirInvitado.zip} onChange={v => { setDirInvitado(p => ({ ...p, zip: v })); if (errorDirInvitado) setErrorDirInvitado('') }} />
                                  </CampoDir>
                                </div>
                                {errorDirInvitado && <div style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 10 }}>{errorDirInvitado}</div>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 16px' }}>Método de pago</h2>

              {/* Mientras carga la config del negocio (métodos activados,
                  alias de transferencia, etc.) — antes esta sección quedaba
                  vacía y en blanco un instante, como si algo hubiera fallado. */}
              {!config && (
                <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[0, 1, 2].map(i => {
                    const d = i * 90
                    return (
                      <div key={i} style={{ padding: 16, borderRadius: 10, border: '2px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <SkeletonCircle size={20} delay={d} />
                        <Skeleton width={20} height={20} radius={6} delay={d + 30} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                          <SkeletonText width={i === 0 ? '38%' : i === 1 ? '28%' : '46%'} height={13} delay={d + 60} />
                          <SkeletonText width={i === 0 ? '62%' : i === 1 ? '50%' : '58%'} height={10} delay={d + 90} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

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
                {cuponAplicado ? (
                  <div>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 12px', borderRadius: 8,
                      background: cuponError ? 'var(--color-error-bg)' : 'var(--color-success-bg)',
                      border: `1px solid ${cuponError ? 'var(--color-error)' : 'rgba(16,185,129,0.30)'}`,
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: cuponError ? 'var(--color-error)' : 'var(--color-success)', fontWeight: 600, fontFamily: '"Geist Mono", monospace' }}>
                        <CheckCircle2 size={13} /> {cuponAplicado.codigo}{cuponError ? '' : ' aplicado'}
                      </span>
                      <button
                        onClick={quitarCupon}
                        title="Quitar cupón"
                        style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', padding: 2, display: 'inline-flex', alignItems: 'center' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {cuponError && <div style={{ fontSize: 11.5, color: 'var(--color-error)', marginTop: 6 }}>{cuponError}</div>}
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={codigoCupon}
                        onChange={e => { setCodigoCupon(e.target.value); if (errorAplicarCupon) setErrorAplicarCupon('') }}
                        onKeyDown={e => { if (e.key === 'Enter') void aplicarCodigoCupon() }}
                        placeholder="Código del cupón (opcional)"
                        style={{ flex: 1, minWidth: 0, height: 40, padding: '0 12px', borderRadius: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 13, outline: 'none', fontFamily: '"Geist Mono", monospace', textTransform: 'uppercase', boxSizing: 'border-box' }}
                      />
                      <button
                        onClick={() => void aplicarCodigoCupon()}
                        disabled={!codigoCupon.trim() || aplicandoCupon}
                        style={{
                          height: 40, padding: '0 16px', borderRadius: 8, flexShrink: 0,
                          background: !codigoCupon.trim() || aplicandoCupon ? 'var(--color-surface-alt)' : 'var(--color-primary)',
                          color: !codigoCupon.trim() || aplicandoCupon ? 'var(--color-muted)' : '#fff',
                          border: 'none', fontSize: 13, fontWeight: 600,
                          cursor: !codigoCupon.trim() || aplicandoCupon ? 'default' : 'pointer',
                        }}
                      >
                        {aplicandoCupon ? 'Aplicando…' : 'Aplicar'}
                      </button>
                    </div>
                    {errorAplicarCupon && (
                      <div style={{ fontSize: 11.5, color: 'var(--color-error)', marginTop: 6 }}>{errorAplicarCupon}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--color-error-bg)', border: '1px solid var(--color-error)', color: 'var(--color-error)', fontSize: 13 }}>
                {error}
              </div>
            )}

            {(() => {
              const puedeConfirmar = !!envio && !!metodo && metodosDisponibles.length > 0 && direccionCompleta
              return (
                <button
                  onClick={() => void confirmar()}
                  disabled={!puedeConfirmar || enviando}
                  style={{
                    width: '100%', height: 56, borderRadius: 12,
                    background: puedeConfirmar ? 'var(--color-primary)' : 'var(--color-surface-alt)',
                    color: puedeConfirmar ? '#fff' : 'var(--color-muted)',
                    fontSize: 15, fontWeight: 700, border: 'none', cursor: (!puedeConfirmar || enviando) ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    boxShadow: puedeConfirmar ? '0 12px 32px rgba(59,130,246,0.30)' : 'none',
                    opacity: enviando ? 0.7 : 1,
                  }}
                >
                  <Lock size={16} strokeWidth={1.5} />
                  {enviando ? 'Confirmando…' : envio === 'PICKUP' ? 'Reservar y retirar en local' : 'Confirmar compra'} ·{' '}
                  <span style={{ fontFamily: '"Geist Mono", monospace' }}>{fmt(total)}</span>
                </button>
              )
            })()}

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
                <ProdImage hue={it.hue} imgUrl={it.imgUrl} height={56} radius={8} style={{ width: 56, flexShrink: 0 }} />
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
              {descuentoTicket && montoDescuentoTicket > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                  <span style={{ color: 'var(--color-body)' }}>Descuento: {descuentoTicket.nombre}</span>
                  <span style={{ color: 'var(--color-success)', fontFamily: '"Geist Mono", monospace' }}>−{fmt(montoDescuentoTicket)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10, marginTop: 6, borderTop: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Total</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmt(total)}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

// ─── Campo/input del formulario de dirección (guardada o de invitado) ──────
// Mismo estilo que F/I de CheckoutDatos.tsx (era el mismo formulario, movido
// acá) — se repite en vez de compartir un componente entre dos pantallas
// para no acoplarlas por algo tan chico.
function CampoDir({ label, required, children, style }: { label: string; required?: boolean; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
        {label}{required && <span style={{ color: '#EF4444', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

const InputDir = forwardRef<HTMLInputElement, { placeholder?: string; icon?: React.ReactNode; value: string; onChange: (v: string) => void }>(
  function InputDir({ placeholder, icon, value, onChange }, ref) {
    return (
      <div style={{ position: 'relative' }}>
        {icon && <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>{icon}</span>}
        <input ref={ref} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} style={{
          width: '100%', height: 44, padding: `0 14px 0 ${icon ? 40 : 14}px`,
          borderRadius: 8, border: '1px solid var(--color-border)',
          background: 'var(--color-bg)', color: 'var(--color-text)',
          fontSize: 14, outline: 'none', boxSizing: 'border-box',
        }} />
      </div>
    )
  }
)
