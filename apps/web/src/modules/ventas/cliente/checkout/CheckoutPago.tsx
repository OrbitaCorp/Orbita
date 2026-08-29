import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import {
  Landmark, Lock, ChevronLeft, Store, Truck, Wallet, CheckCircle2, Clock, Tag, AlertTriangle,
  CreditCard, X, MapPin, Plus, Gift, Check, MessageCircle,
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
  meListAddresses, meCreateAddress, meGetCreditNotes, type MeAddress, type MeCreditNote, type CheckoutInput, type ApiCarrier,
} from '@/lib/api'
import { loadCheckoutDraft, clearCheckoutDraft } from '@/lib/storefront/checkoutDraft'

type Metodo = 'CASH' | 'TRANSFER' | 'MERCADOPAGO' | 'COORDINATE_LATER' | 'DEBIT_CARD' | 'CREDIT_CARD'
type Entrega = 'DELIVERY' | 'PICKUP'

const METODO_META: Record<Metodo, { Icon: React.ElementType; titulo: string; desc: string }> = {
  MERCADOPAGO: { Icon: CreditCard, titulo: 'Mercado Pago', desc: 'Tarjeta, débito o dinero en cuenta' },
  CASH:        { Icon: Wallet,     titulo: 'Efectivo',        desc: 'Pagás al recibir o al retirar' },
  // Ya no muestra CBU/alias acá — el negocio te escribe por WhatsApp para
  // coordinar cómo pagás (antes decía "Transferencia" y mostraba los datos
  // bancarios de entrada).
  TRANSFER:    { Icon: Landmark,   titulo: 'Coordinar por WhatsApp', desc: 'El negocio te contacta para coordinar el pago' },
  // No pide ningún dato de pago acá — el negocio te contacta después para
  // coordinar cómo pagás (a diferencia de Transferencia, que ya muestra
  // CBU/alias de entrada).
  COORDINATE_LATER: { Icon: MessageCircle, titulo: 'Coordinar con el vendedor', desc: 'Sin pago acá, te contactamos para coordinarlo' },
  // Posnet físico en el local — solo aparecen como opción con Retiro en
  // local, y solo si el negocio los habilitó (ver metodosDisponibles).
  DEBIT_CARD:  { Icon: CreditCard, titulo: 'Débito',  desc: 'Pagás con posnet al retirar' },
  CREDIT_CARD: { Icon: CreditCard, titulo: 'Crédito', desc: 'Pagás con posnet al retirar' },
}
// 'Retiro en local' dejó de ser un método de pago — ahora es una forma de
// entrega (Entrega), independiente de cómo se paga (ver checkout.dto.ts).
const ENTREGA_META: Record<Entrega, { Icon: React.ElementType; titulo: string; desc: string }> = {
  DELIVERY: { Icon: Truck, titulo: 'Envío a domicilio', desc: 'El costo se coordina por WhatsApp' },
  PICKUP:   { Icon: Store, titulo: 'Retiro en local',    desc: 'Reservamos el stock, retirás cuando quieras' },
}
// Con qué transportista prefiere el cliente que se coordine el envío — no es
// una cotización (todavía no hay costo calculado, ver Seguimiento.tsx que ya
// usa este mismo enum para el link de tracking una vez despachado).
const CARRIER_LABEL: Record<ApiCarrier, string> = {
  CORREO_ARGENTINO: 'Correo Argentino', OCA: 'OCA', ANDREANI: 'Andreani', VIA_CARGO: 'Vía Cargo',
  // Delivery en moto/app (tipo Uber/PedidosYa/Rappi) — a diferencia de los
  // correos nacionales, no tiene sucursales propias (siempre a domicilio).
  DELIVERY_APP: 'Delivery local (moto/app)',
  OTRO: 'Otro / a coordinar',
}
// Las 23 provincias + CABA — se eligen de una lista en vez de tipearse a
// mano para evitar variantes ("Bs As", "Cordoba" sin tilde, etc.) que
// después complican filtrar/agrupar pedidos por provincia en el panel.
const PROVINCIAS_ARGENTINA = [
  'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Ciudad Autónoma de Buenos Aires',
  'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis',
  'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego, Antártida e Islas del Atlántico Sur',
  'Tucumán',
]

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
  const draftCompleto = !!draft?.buyer?.name?.trim() && !!draft?.buyer?.email?.trim() && !!draft?.buyer?.phone?.trim() && !!draft?.buyer?.dni?.trim()
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

  // ── Transportista preferido — solo aplica con envío a domicilio. Todavía
  // no hay cotización real (el costo se sigue coordinando por WhatsApp
  // aparte, ver aviso más abajo): es la preferencia del cliente nomás, para
  // que el negocio sepa con quién coordinar sin tener que preguntarlo.
  // Transportistas que el negocio activó de verdad en Configuración — vacío
  // (nunca configurado) = mostrar todos, igual criterio que el backend.
  const carriersDisponibles = useMemo<ApiCarrier[]>(() => {
    const todos = Object.keys(CARRIER_LABEL) as ApiCarrier[]
    const enabled = config?.shipping?.enabledCarriers
    return enabled && enabled.length > 0 ? todos.filter(c => enabled.includes(c)) : todos
  }, [config])
  const [carrierSel, setCarrierSel] = useState<ApiCarrier | null>(null)
  const [errorCarrier, setErrorCarrier] = useState('')
  // Con el transportista ya elegido: a domicilio, o el comprador retira en
  // una sucursal DE ESE TRANSPORTISTA (red propia del correo — ej. cualquier
  // sucursal de Correo Argentino). No confundir con "Retiro en local" de
  // arriba, que es en el local DE LA TIENDA — acá siempre hay un envío de
  // por medio, solo cambia si lo trae el cartero o lo pasa a buscar el
  // comprador a una sucursal del correo.
  const [carrierModeSel, setCarrierModeSel] = useState<'DOMICILIO' | 'SUCURSAL' | null>(null)
  const [errorCarrierMode, setErrorCarrierMode] = useState('')

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

  // ── Notas de crédito — solo un cliente con sesión puede tener alguna (un
  // invitado nunca). Se pueden combinar varias (se suman); si cubren todo el
  // total, "Método de pago" deja de ser obligatorio. Si una nota seleccionada
  // sobra respecto al total, el sobrante se pierde (mismo criterio que el
  // backend — ver OrdersService.create()): no hay vuelto ni saldo parcial.
  const [notasDisponibles, setNotasDisponibles] = useState<MeCreditNote[]>([])
  const [notasSel, setNotasSel] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!cliente) { setNotasDisponibles([]); setNotasSel(new Set()); return }
    meGetCreditNotes().then(r => setNotasDisponibles(r.data)).catch(() => {})
  }, [cliente])
  const toggleNota = (id: string) => setNotasSel(prev => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

  async function agregarDireccion() {
    // Calle/provincia/ciudad/CP son obligatorios — sin eso no se puede
    // ubicar ni coordinar el envío. Piso/depto/alias quedan opcionales
    // (no todo domicilio tiene piso o depto, y el alias es solo para que el
    // cliente identifique la dirección en su lista).
    const faltaAlgun = (['street', 'provincia', 'city', 'zip'] as const).some(k => !nueva[k].trim())
    if (faltaAlgun) { setErrorDir('Completá dirección, provincia, ciudad y CP'); return }
    setGuardandoDir(true)
    setErrorDir('')
    try {
      const creada = await meCreateAddress({
        alias: nueva.alias.trim() || undefined,
        street: nueva.street.trim(),
        floor: nueva.floor.trim() || undefined,
        depto: nueva.depto.trim() || undefined,
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
  const provinciaRef = useRef<HTMLSelectElement>(null)
  const ciudadRef = useRef<HTMLInputElement>(null)
  const zipRef = useRef<HTMLInputElement>(null)
  // Piso/depto/referencia quedan fuera de esta lista: son los campos
  // opcionales, no bloquean el envío ni necesitan foco por error.
  const dirInvitadoRefsObligatorios = { street: direccionRef, provincia: provinciaRef, city: ciudadRef, zip: zipRef }

  // "Coordinar el pago después" no es un método más de la lista — es un
  // flujo completo, distinto de "Coordinar por WhatsApp" (antes
  // Transferencia, que sigue siendo un método seleccionable sin CBU/alias).
  // Si el negocio lo activó, el checkout no ofrece NINGÚN método: ni Mercado
  // Pago, ni nada — el cliente completa sus datos y confirma directo, sin
  // elegir cómo paga (ver más abajo, reemplaza toda la sección).
  const coordinarDespuesActivo = !!config?.payment?.acceptsCoordinateLater

  // Métodos que el negocio activó de verdad en Configuración — Mercado Pago
  // exige además la conexión OAuth real (mercadopagoAvailable), no solo el
  // toggle: un negocio puede tener el toggle prendido sin haber conectado
  // todavía su cuenta. Con Retiro en local, además, Efectivo/Débito/Crédito
  // dependen de `pickupPaymentMethods` — pero esa lista es una RESTRICCIÓN
  // puntual, no el interruptor principal: vacía = sin restricción, cada
  // medio sigue valiendo según su propio toggle global (mismo criterio que
  // enabledCarriers). Recién si el negocio marca algo ahí, el retiro queda
  // acotado a exactamente eso — sin este fallback, un negocio que nunca
  // tocó esa lista (la inmensa mayoría) perdía Efectivo/MP/WhatsApp en
  // retiro de un día para el otro (regresión real, encontrada y corregida).
  // Débito/Crédito son la única excepción real: posnet físico sin ningún
  // toggle global, siempre necesitan estar marcados para aparecer. Coordinar
  // por WhatsApp queda fuera de esta restricción a propósito — siempre sigue
  // el toggle general (acceptsTransfer), nunca se acota puntual para retiro.
  const metodosDisponibles = useMemo<Metodo[]>(() => {
    const p = config?.payment
    if (!p || coordinarDespuesActivo) return []
    if (envio === 'PICKUP') {
      const pickup = p.pickupPaymentMethods ?? []
      const sinRestriccion = pickup.length === 0
      return (['MERCADOPAGO', 'CASH', 'TRANSFER', 'DEBIT_CARD', 'CREDIT_CARD'] as Metodo[]).filter(m => {
        if (m === 'MERCADOPAGO') return p.mercadopagoAvailable && (sinRestriccion || pickup.includes('MERCADOPAGO'))
        if (m === 'TRANSFER') return p.acceptsTransfer
        if (m === 'CASH') return p.acceptsCash && (sinRestriccion || pickup.includes('CASH'))
        if (m === 'DEBIT_CARD') return pickup.includes('DEBIT')
        return pickup.includes('CREDIT') // CREDIT_CARD
      })
    }
    return (['MERCADOPAGO', 'TRANSFER'] as Metodo[]).filter(m => m === 'MERCADOPAGO' ? p.mercadopagoAvailable : p.acceptsTransfer)
  }, [config, envio, coordinarDespuesActivo])

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

  // Costo de envío — SIEMPRE por transportista (carrierShippingCosts), sin
  // costo general de respaldo: si el transportista elegido no tiene uno
  // cargado, no hay costo de envío calculado (se sigue coordinando aparte).
  // "Envío gratis desde" lo baja a $0 si el subtotal ya lo supera. Solo
  // aplica con envío a domicilio — retiro en local nunca tiene costo de
  // envío. Esto es una ESTIMACIÓN para mostrarle al comprador acá: el costo
  // real que se cobra lo vuelve a calcular el backend al confirmar (mismo
  // criterio que el resto de los montos — nunca se confía en el cliente),
  // así que si algo desincroniza entre el momento de ver esto y confirmar,
  // gana el cálculo del backend.
  const costoEnvioBase = envio === 'DELIVERY' && carrierSel
    ? config?.shipping?.carrierShippingCosts?.[carrierSel] ?? null
    : null
  const gratisDesde = config?.shipping?.freeShippingFrom
  const costoEnvio = costoEnvioBase != null && gratisDesde != null && subtotal >= gratisDesde
    ? 0
    : costoEnvioBase

  const total = Math.max(0, subtotal - descuentoEfectivo - montoDescuentoTicket + (costoEnvio ?? 0))

  // Las notas de crédito NO son un descuento (no tocan `total`, que es el
  // valor real de la venta) — son una forma de pago más, igual que Mercado
  // Pago o transferencia. `totalAPagar` es lo que queda por cubrir con un
  // método de pago de verdad después de aplicarlas.
  const montoNotasSel = notasDisponibles.filter(n => notasSel.has(n.id)).reduce((acc, n) => acc + n.amount, 0)
  const montoCubiertoConNotas = Math.min(montoNotasSel, total)
  const totalAPagar = Math.max(0, Math.round((total - montoCubiertoConNotas) * 100) / 100)
  const cubiertoPorCompleto = totalAPagar <= 0 && montoCubiertoConNotas > 0

  // Con envío a domicilio, hace falta una dirección resuelta: para un
  // cliente con sesión, una de sus direcciones guardadas elegida; para un
  // invitado, calle/provincia/ciudad/CP completos (piso/depto/referencia son
  // opcionales, mismo criterio que la dirección guardada).
  const direccionCompleta = envio !== 'DELIVERY'
    || (cliente ? !!dirSel : (['street', 'provincia', 'city', 'zip'] as const).every(k => dirInvitado[k].trim()))

  async function confirmar() {
    // `metodo` solo hace falta si todavía queda algo por pagar después de
    // las notas de crédito Y el negocio no tiene "coordinar el pago después"
    // activado — con ese flujo no hay método que elegir en absoluto.
    if (!draft || !draftCompleto || !envio || (!cubiertoPorCompleto && !coordinarDespuesActivo && !metodo) || enviando) return
    if (envio === 'DELIVERY' && !carrierSel) {
      setErrorCarrier('Elegí con qué transportista coordinar el envío')
      return
    }
    if (envio === 'DELIVERY' && carrierSel && carrierSel !== 'DELIVERY_APP' && !carrierModeSel) {
      setErrorCarrierMode('Elegí si lo recibís a domicilio o en una sucursal')
      return
    }
    if (envio === 'DELIVERY' && !cliente && !direccionCompleta) {
      const faltante = (Object.entries(dirInvitadoRefsObligatorios) as [keyof typeof dirInvitado, React.RefObject<HTMLInputElement | HTMLSelectElement>][])
        .find(([campo]) => !dirInvitado[campo].trim())
      setErrorDirInvitado('Completá dirección, provincia, ciudad y CP')
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
        carrier: envio === 'DELIVERY' ? (carrierSel ?? undefined) : undefined,
        // Delivery local siempre a domicilio — no se le pregunta al cliente.
        carrierDeliveryMode: envio === 'DELIVERY'
          ? (carrierSel === 'DELIVERY_APP' ? 'DOMICILIO' : (carrierModeSel ?? undefined))
          : undefined,
        shippingAddressId: envio === 'DELIVERY' && cliente ? (dirSel ?? undefined) : undefined,
        shippingAddress: envio === 'DELIVERY' && !cliente ? {
          street: dirInvitado.street.trim(),
          floor: dirInvitado.floor.trim() || undefined,
          depto: dirInvitado.depto.trim() || undefined,
          referencia: dirInvitado.referencia.trim() || undefined,
          provincia: dirInvitado.provincia.trim(),
          city: dirInvitado.city.trim(),
          zip: dirInvitado.zip.trim(),
        } : undefined,
        // Sin método si las notas de crédito ya cubren todo, o si el negocio
        // tiene "coordinar el pago después" activado (el backend lo fuerza
        // solo de cualquier forma, ver storefront.controller.ts checkout()).
        paymentMethod: (cubiertoPorCompleto || coordinarDespuesActivo) ? undefined : (metodo ?? undefined),
        couponCode: cuponAplicado?.codigo || undefined,
        creditNoteIds: notasSel.size ? Array.from(notasSel) : undefined,
      }
      const pedido = await checkoutStorefront(slug, payload)
      // Sin sesión, Confirmacion.tsx necesita el email en la URL para poder
      // pedir el pedido por el endpoint público de tracking (no tiene con
      // qué autenticar el pedido si no). Se captura ACÁ, antes de limpiar el
      // draft — con sesión no hace falta (el backend ya sabe de quién es).
      const emailInvitado = authStatus === 'anonymous' ? draft.buyer.email : null
      const sufijoTracking = emailInvitado ? `&email=${encodeURIComponent(emailInvitado)}` : ''
      // Confirmacion.tsx necesita saber qué método se eligió para mostrar el
      // mensaje correcto (ej. "mandanos el comprobante" con Transferencia) —
      // no alcanza con leerlo de `pedido.payments`: ese array se llena recién
      // cuando se registra un pago de verdad (welcome de MP, o el negocio a
      // mano después — ver el 400 "Los pagos se registran al confirmar el
      // pago online" en OrdersService.create()), así que con Transferencia o
      // Efectivo llega SIEMPRE vacío en este punto, recién creado el pedido.
      const sufijoMetodo = coordinarDespuesActivo ? '&metodo=COORDINATE_LATER' : (metodo ? `&metodo=${metodo}` : '')

      // El pedido ya existe (PENDING) más allá de lo que pase con el pago:
      // se limpia el carrito/draft acá, igual que con los demás métodos, en
      // vez de esperar a que MP confirme.
      vaciar()
      clearCheckoutDraft(slug)

      if (metodo === 'MERCADOPAGO' && !cubiertoPorCompleto) {
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
          router.push(`${base}/checkout/confirmacion?pedido=${pedido.id}${sufijoTracking}${sufijoMetodo}`)
          return
        }
      }
      router.push(`${base}/checkout/confirmacion?pedido=${pedido.id}${sufijoTracking}${sufijoMetodo}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo confirmar el pedido')
      setEnviando(false)
    }
    // OJO: `setEnviando(false)` NO va acá abajo en un `finally` — pasaba
    // antes y rompía Transferencia/Efectivo (bug real, reportado: el
    // comprador terminaba en "Tu carrito está vacío" en vez de la
    // confirmación). El efecto de arriba ("carrito vacío → volver a
    // /carrito") solo se frena mientras `enviando` es true; `vaciar()` ya
    // corrió unas líneas arriba, así que apenas este `finally` volvía a
    // poner `enviando` en false, ese efecto se rearmaba y su
    // `router.replace('/carrito')` le ganaba la carrera al
    // `router.push('/checkout/confirmacion')` de arriba (los dos son
    // navegación SPA, ninguno gana por diseño). Mercado Pago no lo sufría
    // por azar: ahí la navegación real es `window.location.href` (dura,
    // sale de la SPA), no depende de quién gane la carrera interna. Dejar
    // `enviando` en true en el camino exitoso es correcto — el componente
    // se va a desmontar por la navegación, no hace falta reactivar el botón.
  }

  // Sesión sin resolver todavía, o sin datos completos del paso 1
  // (redirigiendo a Datos) — un invitado (authStatus === 'anonymous') sí
  // llega a esta pantalla, comprar sin cuenta es un flujo válido.
  if (authStatus === 'loading' || !draftCompleto) {
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
          <CheckoutStepper step={2} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <SkeletonText width={150} height={13} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Skeleton height={72} radius={10} delay={30} />
                <Skeleton height={72} radius={10} delay={50} />
              </div>
              <SkeletonText width={130} height={13} style={{ marginTop: 8 }} />
              {[1, 2, 3].map(i => <Skeleton key={i} width="100%" height={72} radius={10} delay={80 + i * 40} />)}
            </div>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SkeletonText width={130} height={13} />
              {[1, 2].map(i => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Skeleton width={48} height={48} radius={8} delay={i * 60} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <SkeletonText width="70%" height={11} delay={i * 60 + 20} />
                    <SkeletonText width="40%" height={10} delay={i * 60 + 40} />
                  </div>
                </div>
              ))}
              <div style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
              <SkeletonText width="60%" height={16} delay={180} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* title: nombre real de la tienda, no "Órbita" — mismo criterio que
          el loader global de _app.tsx (el visitante está en el checkout de
          un negocio, no de la plataforma). */}
      <PageLoader visible={redirigiendoMP} message="Redirigiendo a Mercado Pago…" title={tienda.nombre || null} />
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        height: 60, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)',
        padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <a className="ds-hover" href={base} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', padding: '4px 8px', margin: '-4px -8px', borderRadius: 8 }}>
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
                        className="ds-hover"
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
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                                <Store size={16} strokeWidth={1.5} color="var(--color-muted)" style={{ flexShrink: 0, marginTop: 1 }} />
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{config?.payment?.pickupBranchName ?? tienda.nombre}</div>
                                  <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 1 }}>
                                    {config?.payment?.pickupAddress ?? 'La tienda todavía no cargó una dirección, te la va a pasar por WhatsApp.'}
                                  </div>
                                </div>
                              </div>
                              {/* Antes acá se repetían los medios de pago que
                                  acepta el retiro como badges de solo lectura
                                  (RBT-619) — quedaba duplicado con la
                                  selección real de más abajo, que ahora sí
                                  filtra por estos mismos medios. Se saca el
                                  duplicado, queda solo el horario. */}
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
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
                                ¿Con qué transportista preferís que coordinemos? <span style={{ color: '#EF4444' }}>*</span>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {carriersDisponibles.map(c => {
                                  const activeC = carrierSel === c
                                  return (
                                    <button
                                      key={c} type="button"
                                      className="ds-hover"
                                      onClick={() => { setCarrierSel(c); if (errorCarrier) setErrorCarrier('') }}
                                      style={{
                                        height: 38, padding: '0 16px', borderRadius: 999,
                                        border: `1.5px solid ${activeC ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                        background: activeC ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                                        color: activeC ? 'var(--color-primary)' : 'var(--color-body)',
                                        fontSize: 13, fontWeight: activeC ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit',
                                      }}
                                    >
                                      {CARRIER_LABEL[c]}
                                    </button>
                                  )
                                })}
                              </div>
                              {errorCarrier && <div style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 8 }}>{errorCarrier}</div>}
                            </div>

                            {/* Delivery local (moto/app) no tiene red de sucursales propia —
                                siempre es a domicilio, no hace falta preguntar. */}
                            {carrierSel && carrierSel !== 'DELIVERY_APP' && (
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
                                  ¿Lo recibís a domicilio o retirás en una sucursal de {CARRIER_LABEL[carrierSel]}? <span style={{ color: '#EF4444' }}>*</span>
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  {([['DOMICILIO', 'A domicilio'], ['SUCURSAL', `En sucursal de ${CARRIER_LABEL[carrierSel]}`]] as ['DOMICILIO' | 'SUCURSAL', string][]).map(([m, label]) => {
                                    const activeM = carrierModeSel === m
                                    return (
                                      <button
                                        key={m} type="button"
                                        className="ds-hover"
                                        onClick={() => { setCarrierModeSel(m); if (errorCarrierMode) setErrorCarrierMode('') }}
                                        style={{
                                          height: 38, padding: '0 16px', borderRadius: 999,
                                          border: `1.5px solid ${activeM ? 'var(--color-primary)' : 'var(--color-border)'}`,
                                          background: activeM ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                                          color: activeM ? 'var(--color-primary)' : 'var(--color-body)',
                                          fontSize: 13, fontWeight: activeM ? 600 : 500, cursor: 'pointer', fontFamily: 'inherit',
                                        }}
                                      >
                                        {label}
                                      </button>
                                    )
                                  })}
                                </div>
                                {errorCarrierMode && <div style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 8 }}>{errorCarrierMode}</div>}
                              </div>
                            )}

                            <div style={{ padding: 14, borderRadius: 10, background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: 12.5, color: 'var(--color-body)', lineHeight: 1.5 }}>
                              {costoEnvioBase == null
                                ? <>El costo de envío no se cobra acá — te contactamos por WhatsApp después de confirmar el pedido para coordinarlo{carrierSel ? ` con ${CARRIER_LABEL[carrierSel]}` : ''} según tu ubicación.</>
                                : costoEnvio === 0
                                  ? <>Envío <strong style={{ color: 'var(--color-success)' }}>gratis</strong> — ya llegás al mínimo de compra.</>
                                  : <>Costo de envío{carrierSel ? ` con ${CARRIER_LABEL[carrierSel]}` : ''}: <strong style={{ color: 'var(--color-text)' }}>{fmt(costoEnvio!)}</strong>. Ya está sumado al total.</>}
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
                                          className="ds-hover"
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
                                <button className="ds-link" type="button" onClick={() => setShowNewDir(v => !v)} style={{
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
                                      <CampoDir label="Piso"><InputDir placeholder="5" value={nueva.floor} onChange={v => setNueva(p => ({ ...p, floor: v }))} /></CampoDir>
                                      <CampoDir label="Departamento"><InputDir placeholder="B" value={nueva.depto} onChange={v => setNueva(p => ({ ...p, depto: v }))} /></CampoDir>
                                      <CampoDir label="Alias"><InputDir placeholder="Casa" value={nueva.alias} onChange={v => setNueva(p => ({ ...p, alias: v }))} /></CampoDir>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 14 }}>
                                      <CampoDir label="Provincia" required><SelectDir placeholder="Elegí una provincia" options={PROVINCIAS_ARGENTINA} value={nueva.provincia} onChange={v => setNueva(p => ({ ...p, provincia: v }))} /></CampoDir>
                                      <CampoDir label="Ciudad" required><InputDir placeholder="CABA" value={nueva.city} onChange={v => setNueva(p => ({ ...p, city: v }))} /></CampoDir>
                                      <CampoDir label="CP" required><InputDir placeholder="C1043" value={nueva.zip} onChange={v => setNueva(p => ({ ...p, zip: v }))} /></CampoDir>
                                    </div>
                                    {errorDir && <div style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 10 }}>{errorDir}</div>}
                                    <button className="ds-hover" type="button" onClick={() => void agregarDireccion()} disabled={guardandoDir} style={{
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
                                  <CampoDir label="Piso">
                                    <InputDir placeholder="5" value={dirInvitado.floor} onChange={v => setDirInvitado(p => ({ ...p, floor: v }))} />
                                  </CampoDir>
                                  <CampoDir label="Departamento">
                                    <InputDir placeholder="B" value={dirInvitado.depto} onChange={v => setDirInvitado(p => ({ ...p, depto: v }))} />
                                  </CampoDir>
                                  <CampoDir label="Referencia">
                                    <InputDir placeholder="Portón negro" value={dirInvitado.referencia} onChange={v => setDirInvitado(p => ({ ...p, referencia: v }))} />
                                  </CampoDir>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 14 }}>
                                  <CampoDir label="Provincia" required>
                                    <SelectDir ref={provinciaRef} placeholder="Elegí una provincia" options={PROVINCIAS_ARGENTINA} value={dirInvitado.provincia} onChange={v => { setDirInvitado(p => ({ ...p, provincia: v })); if (errorDirInvitado) setErrorDirInvitado('') }} />
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

            {/* ── Notas de crédito — solo si el cliente con sesión tiene
                alguna disponible. Se pueden tildar varias (se suman) y
                combinar con un cupón: son cosas distintas, el cupón baja el
                precio real de la venta, esto paga parte de lo que queda. ── */}
            {cliente && notasDisponibles.length > 0 && (
              <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 24 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Gift size={17} strokeWidth={1.8} /> Tus notas de crédito
                </h2>
                <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginBottom: 14 }}>
                  Saldo a favor de compras anteriores — se descuenta del total.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {notasDisponibles.map(n => {
                    const on = notasSel.has(n.id)
                    return (
                      <label
                        key={n.id}
                        className="ds-hover"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 10, cursor: 'pointer',
                          background: on ? 'var(--color-primary-bg)' : 'var(--color-bg)',
                          border: `2px solid ${on ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        }}
                      >
                        <span style={{
                          width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                          border: `1.5px solid ${on ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
                          background: on ? 'var(--color-primary)' : 'transparent',
                          display: 'grid', placeItems: 'center',
                        }}>
                          {on && <Check size={11} strokeWidth={3} color="#fff" />}
                        </span>
                        <input type="checkbox" checked={on} onChange={() => toggleNota(n.id)} style={{ display: 'none' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmt(n.amount)}</div>
                          {n.expiresAt && (
                            <div style={{ fontSize: 11, color: 'var(--color-subtle)', marginTop: 1 }}>
                              Vence {new Date(n.expiresAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
                {montoCubiertoConNotas > 0 && (
                  <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--color-success-bg)', fontSize: 12.5, color: 'var(--color-success)', fontWeight: 500 }}>
                    Se descuentan {fmt(montoCubiertoConNotas)} del total.
                    {cubiertoPorCompleto ? ' Tu compra queda cubierta, no hace falta elegir otro método de pago.' : ` Te quedan ${fmt(totalAPagar)} por pagar.`}
                  </div>
                )}
              </div>
            )}

            {/* "Coordinar el pago después" reemplaza TODA esta sección — no
                es un método más, es que no hay ningún método que elegir. */}
            {!cubiertoPorCompleto && coordinarDespuesActivo && (
              <div style={{ display: 'flex', gap: 12, padding: 18, borderRadius: 12, background: 'var(--color-success-bg)', border: '1px solid rgba(16,185,129,0.30)' }}>
                <MessageCircle size={20} strokeWidth={1.5} color="var(--color-success)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13.5, color: 'var(--color-body)', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--color-text)' }}>No hace falta que elijas cómo pagar.</strong> Confirmá el
                  pedido y el negocio se va a comunicar con vos lo antes posible para coordinarlo.
                </div>
              </div>
            )}

            {!cubiertoPorCompleto && !coordinarDespuesActivo && (
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
                      className="ds-hover"
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

                      {/* ── Panel Coordinar por WhatsApp ── */}
                      {active && id === 'TRANSFER' && (
                        <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: 'var(--color-success-bg)', border: '1px solid rgba(16,185,129,0.30)', fontSize: 12.5, color: 'var(--color-success)', fontWeight: 500 }}>
                          No hace falta que pagues ahora — el negocio te va a escribir por WhatsApp para coordinar cómo pagás, apenas confirmes el pedido.
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
            )}

            {(cubiertoPorCompleto || coordinarDespuesActivo || metodosDisponibles.length > 0) && (
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
                        className="ds-hover"
                        onClick={quitarCupon}
                        title="Quitar cupón"
                        style={{ background: 'none', border: 'none', color: 'var(--color-muted)', cursor: 'pointer', padding: 2, borderRadius: 6, display: 'inline-flex', alignItems: 'center' }}
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
                        className="ds-field"
                        value={codigoCupon}
                        onChange={e => { setCodigoCupon(e.target.value); if (errorAplicarCupon) setErrorAplicarCupon('') }}
                        onKeyDown={e => { if (e.key === 'Enter') void aplicarCodigoCupon() }}
                        placeholder="Código del cupón (opcional)"
                        style={{ flex: 1, minWidth: 0, height: 40, padding: '0 12px', borderRadius: 8, background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 13, outline: 'none', fontFamily: '"Geist Mono", monospace', textTransform: 'uppercase', boxSizing: 'border-box' }}
                      />
                      <button
                        className="ds-hover"
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
              // Sin método hace falta, salvo que las notas de crédito ya
              // cubran todo, o el negocio tenga "coordinar el pago después"
              // activado — en los dos casos alcanza con haber elegido cómo
              // se entrega.
              const puedeConfirmar = !!envio
                && (cubiertoPorCompleto || coordinarDespuesActivo || (!!metodo && metodosDisponibles.length > 0))
                && direccionCompleta
                && (envio !== 'DELIVERY' || !!carrierSel)
                && (envio !== 'DELIVERY' || carrierSel === 'DELIVERY_APP' || !!carrierModeSel)
              return (
                <button
                  className="ds-hover"
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
                  <span style={{ fontFamily: '"Geist Mono", monospace' }}>{fmt(totalAPagar)}</span>
                </button>
              )
            })()}

            <button className="ds-link" onClick={() => router.push(`${base}/checkout/datos`)} style={{
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
            {/* precioAnt (precio de lista, antes del descuento automático que
                ya trae el producto — oferta/promo, NADA que ver con el
                cupón del pedido) tachado + el % real, igual que Carrito.tsx.
                Antes acá solo se veía el precio YA descontado sin ningún
                indicio de por qué (un producto en $0 por una oferta del
                100% se veía simplemente como "$0", sin explicación —
                reportado por el dueño). El cupón del pedido (TICKET, no por
                producto) ya tenía su propia línea más abajo
                ("Descuento: {nombre}"), sin cambios ahí. */}
            {items.map(it => {
              const enOferta = it.precioAnt != null && it.precioAnt > it.precio
              const pct = enOferta ? Math.round((1 - it.precio / it.precioAnt!) * 100) : 0
              return (
                <div key={it.id} style={{ display: 'flex', gap: 12, padding: '8px 0', alignItems: 'center' }}>
                  <ProdImage hue={it.hue} imgUrl={it.imgUrl} height={56} radius={8} style={{ width: 56, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.nombre}</div>
                      {enOferta && (
                        <span style={{
                          flexShrink: 0, display: 'inline-flex', height: 16, padding: '0 5px', borderRadius: 999,
                          background: 'var(--color-error-bg)', color: 'var(--color-error)',
                          fontSize: 9.5, fontWeight: 700, alignItems: 'center',
                        }}>−{pct}%</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-subtle)', marginTop: 2 }}>x{it.qty}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmt(it.precio * it.qty)}</div>
                    {enOferta && (
                      <div style={{ fontSize: 11, color: 'var(--color-subtle)', textDecoration: 'line-through', fontFamily: '"Geist Mono", monospace' }}>
                        {fmt(it.precioAnt! * it.qty)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
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
              {/* La tasa entre paréntesis (1% / $500) — antes solo se veía el
                  monto final, sin ninguna pista de si salía de un % o de un
                  fijo (pedido explícito del dueño, con captura de esta
                  misma pantalla). */}
              {descuentoTicket && montoDescuentoTicket > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, gap: 8 }}>
                  <span style={{ color: 'var(--color-body)' }}>
                    Descuento: {descuentoTicket.nombre} ({descuentoTicket.esPorcentaje ? `${descuentoTicket.valor}%` : fmt(descuentoTicket.valor)})
                  </span>
                  <span style={{ color: 'var(--color-success)', fontFamily: '"Geist Mono", monospace', flexShrink: 0 }}>−{fmt(montoDescuentoTicket)}</span>
                </div>
              )}
              {costoEnvioBase != null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                  <span style={{ color: 'var(--color-body)' }}>Envío</span>
                  <span style={{ color: costoEnvio === 0 ? 'var(--color-success)' : 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>
                    {costoEnvio === 0 ? 'Gratis' : fmt(costoEnvio!)}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 10, marginTop: 6, borderTop: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>Total</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmt(total)}</span>
              </div>
              {montoCubiertoConNotas > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}>
                    <span style={{ color: 'var(--color-body)', display: 'flex', alignItems: 'center', gap: 5 }}><Gift size={13} /> Notas de crédito</span>
                    <span style={{ color: 'var(--color-success)', fontFamily: '"Geist Mono", monospace' }}>−{fmt(montoCubiertoConNotas)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 8, marginTop: 4, borderTop: '1px dashed var(--color-border)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>A pagar</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', fontFamily: '"Geist Mono", monospace' }}>{fmt(totalAPagar)}</span>
                  </div>
                </>
              )}
            </div>
            {config?.shipping?.shippingPolicy?.trim() && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--color-border)', fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {config.shipping.shippingPolicy}
              </div>
            )}
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
        <input ref={ref} className="ds-field" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} style={{
          width: '100%', height: 44, padding: `0 14px 0 ${icon ? 40 : 14}px`,
          borderRadius: 8, border: '1px solid var(--color-border)',
          background: 'var(--color-bg)', color: 'var(--color-text)',
          fontSize: 14, outline: 'none', boxSizing: 'border-box',
        }} />
      </div>
    )
  }
)

// Mismo estilo que InputDir — se usa para Provincia (lista cerrada, en vez
// de texto libre) en los dos formularios de dirección.
const SelectDir = forwardRef<HTMLSelectElement, { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }>(
  function SelectDir({ value, onChange, options, placeholder }, ref) {
    return (
      <select ref={ref} className="ds-field" value={value} onChange={e => onChange(e.target.value)} style={{
        width: '100%', height: 44, padding: '0 14px',
        borderRadius: 8, border: '1px solid var(--color-border)',
        background: 'var(--color-bg)', color: value ? 'var(--color-text)' : 'var(--color-subtle)',
        fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
      }}>
        <option value="" disabled>{placeholder}</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
)
