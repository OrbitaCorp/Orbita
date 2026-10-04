// ─── Checkout simulado de la tienda demo ────────────────────────────────────
//
// La compra se arma en el navegador con precios REALES: el carrito se valida
// contra la API (cart/validate, la única escritura pública que DemoGuard deja
// pasar) y los descuentos por método de pago y el envío salen de la config
// real de la tienda. El pedido queda en localStorage (recurso "pedidos-tienda")
// y la confirmación lo lee de ahí.
//
// Mercado Pago: el botón está (la API marca mercadopagoAvailable en la demo),
// pero en vez de ir a MP se abre /checkout/pago-simulado, que aprueba el pago
// localmente y vuelve a la confirmación como lo haría la vuelta de MP.
import type { CheckoutInput, CheckoutOrder, MeAddress, MeOrderDetail, MeOrdersResponse } from '@/lib/api'
import type { StorefrontConfigResponse } from '@/lib/storefront/api'
import { apiReal, json, leerJson, registrar } from '../interceptor'
import { validarCarritoDemo } from './juegos'
import { crear, esIdLocal, leerCapa, aplicarARegistro, nuevoId } from '../almacen'
import { DEMO_SLUG } from '../modo'

export const PEDIDOS_TIENDA = 'pedidos-tienda'

export type PedidoTiendaDemo = MeOrderDetail & { metodo: string | null }

async function apiJson<T>(ruta: string, init?: RequestInit): Promise<T | null> {
  const res = await apiReal(ruta, init).catch(() => null)
  return res ? leerJson<T>(res) : null
}

/** Lo que muestra la tienda en la URL: /tienda/demo en dev sin subdominio, nada en demo.orbita.site. */
export function baseTiendaDemo(): string {
  return window.location.pathname.startsWith(`/tienda/${DEMO_SLUG}`) ? `/tienda/${DEMO_SLUG}` : ''
}

const redondear = (n: number) => Math.round(n * 100) / 100

registrar({
  metodo: 'POST',
  ruta: /^\/storefront\/([^/]+)\/checkout$/,
  lado: 'tienda',
  responder: async (p, m) => {
    const slug = m[1]
    const input = p.body as CheckoutInput
    const [validacion, config] = await Promise.all([
      // Acepta también los cupones de premio de los juegos (ver juegos.ts).
      validarCarritoDemo(slug, { items: input.items, couponCode: input.couponCode }),
      apiJson<StorefrontConfigResponse>(`/storefront/${slug}`),
    ])
    if (!validacion || !config) return json({ message: 'No se pudo confirmar el pedido. Probá de nuevo.' }, 503)
    const sinStock = validacion.items.find((i) => !i.ok)
    if (sinStock) return json({ message: `${sinStock.nombre ?? 'Un producto'} ya no tiene stock suficiente` }, 400)
    if (validacion.coupon && !validacion.coupon.ok) return json({ message: validacion.coupon.reason }, 400)

    const cantidad = new Map(input.items.map((i) => [i.variantId, i.quantity]))
    const lineas = validacion.items.map((i) => ({ ...i, qty: cantidad.get(i.variantId) ?? 1 }))
    const lista = redondear(lineas.reduce((a, l) => a + (l.precioAnt ?? l.precio ?? 0) * l.qty, 0))
    const conPromos = redondear(lineas.reduce((a, l) => a + (l.precio ?? 0) * l.qty, 0))

    const pct: Record<string, number | null | undefined> = {
      CASH: config.payment?.cashDiscountPercent,
      MERCADOPAGO: config.payment?.mercadopagoDiscountPercent,
      TRANSFER: config.payment?.transferDiscountPercent,
    }
    const pctMetodo = input.paymentMethod ? pct[input.paymentMethod] ?? 0 : 0
    const descMetodo = Math.round(conPromos * pctMetodo) / 100
    const descTicket = validacion.ticketDiscount?.monto ?? 0

    const costoCarrier = input.shippingMethod === 'DELIVERY' && input.carrier ? config.shipping?.carrierShippingCosts?.[input.carrier] ?? null : null
    const gratisDesde = config.shipping?.freeShippingFrom
    const envio = costoCarrier != null && gratisDesde != null && conPromos >= gratisDesde ? 0 : costoCarrier

    const discountTotal = redondear(lista - conPromos + descMetodo + descTicket)
    const total = redondear(Math.max(0, lista - discountTotal + (envio ?? 0)))
    const ahora = new Date().toISOString()
    const previos = leerCapa(PEDIDOS_TIENDA).creados.length
    // El Invitado elige una de sus direcciones guardadas: se copia al pedido,
    // como hace el backend.
    const guardada = input.shippingAddressId
      ? (await apiJson<MeAddress[]>('/me/addresses', { headers: p.headers }))?.find((a) => a.id === input.shippingAddressId) ?? null
      : null
    const dir = input.shippingAddress ?? (guardada
      ? { street: guardada.street, floor: guardada.floor ?? undefined, depto: guardada.depto ?? undefined, referencia: guardada.referencia ?? undefined, provincia: guardada.provincia ?? '', city: guardada.city, zip: guardada.zip ?? '' }
      : undefined)
    const esMp = input.paymentMethod === 'MERCADOPAGO'

    const pedido: PedidoTiendaDemo = {
      id: nuevoId(),
      orderNumber: 1001 + previos,
      status: 'PENDING',
      createdAt: ahora,
      subtotal: lista,
      discountTotal,
      total,
      notes: null,
      ivaRatePercent: config.payment?.ivaRate ?? null,
      items: lineas.map((l, i) => ({
        id: `${i}`,
        productName: l.nombre ?? 'Producto',
        variantLabel: l.variante,
        imgUrl: l.imgUrl,
        quantity: l.qty,
        unitPrice: l.precio ?? 0,
      })),
      onlineOrderDetails: {
        buyerName: input.buyer.name,
        buyerEmail: input.buyer.email,
        buyerPhone: input.buyer.phone,
        buyerDni: input.buyer.dni,
        carrier: input.carrier ?? null,
        carrierDeliveryMode: input.carrierDeliveryMode ?? null,
        tracking: null,
        shippingAddressId: guardada?.id ?? null,
        shippingAddress: guardada,
        shippingMethod: input.shippingMethod,
        shippingStreet: dir?.street ?? null,
        shippingFloor: dir?.floor ?? null,
        shippingDepto: dir?.depto ?? null,
        shippingReferencia: dir?.referencia ?? null,
        shippingProvincia: dir?.provincia ?? null,
        shippingCity: dir?.city ?? null,
        shippingZip: dir?.zip ?? null,
        shippingCost: envio,
      },
      statusHistory: [{ status: 'PENDING', createdAt: ahora }],
      payments: esMp ? [{ method: 'MERCADOPAGO', status: 'PENDING' }] : [],
      returns: [],
      cancellationRequests: [],
      metodo: input.paymentMethod ?? null,
    }
    crear(PEDIDOS_TIENDA, pedido)

    const respuesta: CheckoutOrder = {
      id: pedido.id, orderNumber: pedido.orderNumber, status: pedido.status,
      subtotal: pedido.subtotal, discountTotal: pedido.discountTotal, total: pedido.total,
      notes: null, createdAt: ahora,
    }
    return respuesta
  },
})

// "Ir a pagar" con Mercado Pago → pantalla de pago simulado de la demo.
registrar({
  metodo: 'POST',
  ruta: /^\/mercadopago\/orders$/,
  lado: 'tienda',
  responder: async (p) => {
    const orderId = (p.body as { orderId?: string } | null)?.orderId ?? ''
    if (!esIdLocal(orderId)) return p.real()
    const initPoint = `${window.location.origin}${baseTiendaDemo()}/checkout/pago-simulado?pedido=${encodeURIComponent(orderId)}`
    return { mpOrderId: 'demo', initPoint }
  },
})

// La vuelta "de MP" confirma el pago: ya lo hizo la pantalla simulada.
registrar({
  metodo: 'POST',
  ruta: /^\/mercadopago\/orders\/([^/]+)\/sync-payment$/,
  lado: 'tienda',
  responder: async (p, m) => (esIdLocal(decodeURIComponent(m[1])) ? { ok: true } : p.real()),
})

// Seguimiento del pedido (confirmación y "Mis pedidos" de un invitado).
registrar({
  metodo: 'GET',
  ruta: /^\/storefront\/[^/]+\/orders\/([^/]+)\/tracking$/,
  lado: 'tienda',
  responder: async (p, m) => {
    const id = decodeURIComponent(m[1])
    if (!esIdLocal(id)) return p.real()
    const pedido = aplicarARegistro<PedidoTiendaDemo>(PEDIDOS_TIENDA, id, null)
    return pedido ?? json({ message: 'Pedido no encontrado' }, 404)
  },
})

// "Mis pedidos" del Invitado: los que compró en la demo (en este navegador)
// arriba de los sembrados.
registrar({
  metodo: 'GET',
  ruta: /^\/me\/orders$/,
  lado: 'tienda',
  responder: async (p) => {
    const res = await p.real()
    const real = await leerJson<MeOrdersResponse>(res.clone())
    if (!real) return res
    const locales = leerCapa<PedidoTiendaDemo>(PEDIDOS_TIENDA).creados
    if (locales.length === 0) return real
    const filas = locales.map((o) => ({
      id: o.id, orderNumber: o.orderNumber, status: o.status,
      subtotal: o.subtotal, discountTotal: o.discountTotal, total: o.total,
      itemCount: o.items.reduce((a, i) => a + i.quantity, 0), createdAt: o.createdAt,
      devolucionAprobada: false, notaCreditoMonto: 0,
    }))
    return {
      data: [...filas, ...real.data],
      resumen: {
        cantidadPedidos: real.resumen.cantidadPedidos + filas.length,
        totalGastado: redondear(real.resumen.totalGastado + filas.reduce((a, f) => a + f.total, 0)),
      },
    }
  },
})

registrar({
  metodo: 'GET',
  ruta: /^\/me\/orders\/([^/]+)$/,
  lado: 'tienda',
  responder: async (p, m) => {
    const id = decodeURIComponent(m[1])
    if (!esIdLocal(id)) return p.real()
    return aplicarARegistro<PedidoTiendaDemo>(PEDIDOS_TIENDA, id, null) ?? json({ message: 'Pedido no encontrado' }, 404)
  },
})
