// Cliente público del storefront — sin auth (rutas @Public() del backend),
// scopeado siempre por slug. Mismo API_BASE que lib/auth/authClient.ts.
//
// Los adaptadores (toTiendaConfig/toCategoria/toProducto) convierten la
// respuesta real del backend a los tipos locales de lib/storefront/types.ts,
// para no tener que reescribir los componentes que ya consumen esos tipos
// (ProductCard, StorefrontHeader/Footer, etc. — ya son prop-driven).

import type { Categoria, Cupon, Oferta, Producto, TiendaConfig } from './types'
import type { MeOrderDetail } from '@/lib/api'
import { tokenStore } from '@/lib/auth/authClient'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'orbita.site'

export class StorefrontApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function storefrontRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/storefront${path}`, init)
  const isJson = res.headers.get('content-type')?.includes('application/json')
  const body = isJson ? await res.json().catch(() => null) : null
  if (!res.ok) {
    const message = body?.message ?? body?.error ?? `Error ${res.status}`
    throw new StorefrontApiError(res.status, Array.isArray(message) ? message.join(', ') : message)
  }
  return body as T
}

// ─── Config (branding + apariencia + contacto) ─────────────────────────────

export type StorefrontHeroSlide = {
  id: string; titulo: string; subtitulo: string; img: string | null; cta: string; ctaLink?: string
  imageStyle?: string; imagePosition?: string; imageOverlay?: string; bgPattern?: string; bgPatternScope?: string; bgColor?: string
}
export type StorefrontHeaderLink = { id: string; label: string; on: boolean }
export type StorefrontStatsItem = { id: string; value: string; label: string }

// Contenido propio de una plantilla de Home. Cada clave la usa UNA plantilla
// (hoy solo `cupon`, de Vidriera) — se van sumando acá a medida que una
// plantilla nueva necesite algo que las demás no tienen.
export type HomeTemplateData = {
  cupon?: { titulo: string; bajada: string; codigo: string } | null
}

export type StorefrontConfigResponse = {
  business: { id: string; name: string; subdomain: string; mode: string; isActive: boolean; isPaused: boolean }
  appearance: {
    storeName: string | null
    tagline: string | null
    logoUrl: string | null
    faviconUrl: string | null
    colorPrimary: string | null
    colorSecondary: string | null
    colorAccent: string | null
    colorBackground: string | null
    colorMode: 'light' | 'dark' | 'system'
    fontFamily: string | null
    fontFamilyBody: string | null
    fontScale: string | number | null
    headerLayout: string | null
    gridLayout: string | null
    cardRadius: number | null
    // Plantilla de Home activa (Avanzado → Plantillas) — null = home clásico.
    // "vidriera" es la única real hoy (ver Inicio.tsx).
    homeTemplate: string | null
    // Campos que pide UNA plantilla puntual y no tienen sentido para las
    // demás (el cupón de Vidriera, por ejemplo). Va como JSON libre a
    // propósito: así una plantilla nueva suma los suyos sin migración de
    // base ni columnas que quedan en null para todas las demás.
    homeTemplateData: HomeTemplateData | null
    heroSlides: StorefrontHeroSlide[]
    headerLinks: StorefrontHeaderLink[]
    showReviews: boolean
    showNewBadge: boolean
    showWhatsapp: boolean
    showLowStock: boolean
    showOfferBadge: boolean
    showSearch: boolean
    showCategoriesSection: boolean
    showFooter: boolean
    showSocialFooter: boolean
    showAnnouncementBar: boolean
    // Banner en modo "cartelera" (se desliza en loop) en vez de fijo
    // centrado — ver AnnouncementBar.tsx.
    announcementScroll: boolean
    showStatsBar: boolean
    shippingText: string | null
    whatsappText: string | null
    statsBar: StorefrontStatsItem[]
  } | null
  contact: {
    whatsapp: string | null
    email: string | null
    scheduleText: string | null
    instagram: string | null
    tiktok: string | null
    facebook: string | null
  } | null
  // Métodos de pago/envío reales de Configuración general — antes el
  // checkout no tenía forma de saber qué activó el negocio. `acceptsMercadopago`
  // es el toggle crudo; `mercadopagoAvailable` además exige la conexión OAuth
  // real (Fase 8) — es el que el checkout usa para decidir si mostrar el botón.
  payment: {
    acceptsMercadopago: boolean
    mercadopagoAvailable: boolean
    acceptsCash: boolean
    acceptsTransfer: boolean
    acceptsPickup: boolean
    transferAlias: string | null
    transferCbu: string | null
    transferHolder: string | null
    cashDiscountPercent: number | null
    // RBT-692 — mismo criterio, generalizado a Mercado Pago y "Transferencia"
    // (acceptsTransfer, hoy "Coordinar por WhatsApp").
    mercadopagoDiscountPercent: number | null
    transferDiscountPercent: number | null
    // RBT-691 — alícuota de IVA del negocio (21 / 10.5 / 0), siempre presente
    // (no depende de ningún toggle, a diferencia de los descuentos de arriba).
    ivaRate: number
    pickupAddress: string | null
    pickupBranchName: string | null
    pickupPaymentMethods: string[]
    // El cliente no elige método de pago: solo confirma el pedido, y el
    // negocio se comunica después para coordinar cómo paga.
    acceptsCoordinateLater: boolean
    // Postventa: qué puede pedir el cliente al devolver/cancelar un pedido
    // (ver Devolucion.tsx/Cancelar.tsx/Seguimiento.tsx) — la aprobación del
    // negocio sigue siendo obligatoria siempre.
    returnsEnabled: boolean
    returnsCreditNoteEnabled: boolean
    returnsMpRefundEnabled: boolean
    cancellationsEnabled: boolean
    cancellationsCreditNoteEnabled: boolean
    cancellationsMpRefundEnabled: boolean
  } | null
  shipping: {
    freeShippingFrom: number | null
    shippingPolicy: string | null
    // Con cuáles de los transportistas el negocio coordina de verdad los
    // envíos — vacío = todos habilitados (retrocompatible).
    enabledCarriers: string[]
    // Costo de envío por transportista — sin costo general de respaldo, un
    // transportista sin costo acá no calcula envío. Parcial: solo trae los
    // que el negocio cargó. Claves = ApiCarrier.
    carrierShippingCosts: Record<string, number>
  } | null
}

export function getStorefrontConfig(slug: string) {
  return storefrontRequest<StorefrontConfigResponse>(`/${slug}`)
}

// ─── Productos ──────────────────────────────────────────────────────────────

export type StorefrontProductItem = {
  id: string
  name: string
  description: string | null
  categoryId: string | null
  categoryName: string | null
  price: number
  comparePrice: number | null
  imageUrl: string | null
  images: string[]
  // Hasta 2 tipos de opción (Color, Talle...) — [] si no tiene. El tope de 2
  // es sobre la CANTIDAD DE TIPOS, no sobre cuántos valores tiene cada uno
  // (todos sus valores vienen siempre). Solo la opción `isVisual` (Color)
  // trae `imageUrl` por valor — el resto siempre null, se muestra como
  // texto (ver ProductCard.tsx).
  variantOptions: { name: string; isVisual: boolean; values: { value: string; imageUrl: string | null }[] }[]
  isFeatured: boolean
  inStock: boolean
  // Nunca la cantidad exacta (no se expone stock real al público) — solo si
  // el producto está en (o por debajo de) su umbral de alerta configurado
  // en el panel. Gateado por el toggle "Insignia de stock bajo" de Apariencia.
  lowStock: boolean
  createdAt: string
}

export type StorefrontSort = 'relevancia' | 'precio-asc' | 'precio-desc' | 'bestselling'

export type StorefrontProductsFilters = {
  // Uno o varios ids (multi-select en el catálogo) — se manda como CSV al
  // backend, ver storefront-products-query.dto.ts.
  categoryId?: string | string[]
  // Filtra a los productos alcanzados por un CUPÓN puntual (alcance producto
  // o categoría) — lo usa DescuentoExclusivo.tsx. Mutuamente excluyente con
  // discountId (uno es cupón por código, el otro descuento por id).
  discountCode?: string
  // Igual que discountCode pero para un DESCUENTO (sin código) — lo usa
  // DescuentoCompartido.tsx (/tienda/:slug/oferta/:id).
  discountId?: string
  search?: string
  featured?: boolean
  onSale?: boolean
  inStock?: boolean
  minPrice?: number
  maxPrice?: number
  sort?: StorefrontSort
  page?: number
  limit?: number
}

export function getStorefrontProducts(slug: string, filters: StorefrontProductsFilters = {}) {
  const qs = new URLSearchParams()
  if (filters.categoryId) qs.set('categoryId', Array.isArray(filters.categoryId) ? filters.categoryId.join(',') : filters.categoryId)
  if (filters.discountCode) qs.set('discountCode', filters.discountCode)
  if (filters.discountId) qs.set('discountId', filters.discountId)
  if (filters.search) qs.set('search', filters.search)
  if (filters.featured) qs.set('featured', 'true')
  if (filters.onSale) qs.set('onSale', 'true')
  if (filters.inStock) qs.set('inStock', 'true')
  if (filters.minPrice !== undefined) qs.set('minPrice', String(filters.minPrice))
  if (filters.maxPrice !== undefined) qs.set('maxPrice', String(filters.maxPrice))
  if (filters.sort && filters.sort !== 'relevancia') qs.set('sort', filters.sort)
  if (filters.page) qs.set('page', String(filters.page))
  if (filters.limit) qs.set('limit', String(filters.limit))
  const query = qs.toString()
  return storefrontRequest<{ data: StorefrontProductItem[]; total: number; page: number; limit: number }>(
    `/${slug}/products${query ? `?${query}` : ''}`,
  )
}

export type StorefrontProductDetail = {
  id: string
  name: string
  description: string | null
  categoryId: string | null
  categoryName: string | null
  price: number
  comparePrice: number | null
  isFeatured: boolean
  // Ficha técnica opcional que el vendedor cargó ("RAM" -> "16GB") — [] =
  // no tiene, el detalle no muestra la tabla de "Características".
  specs: { label: string; value: string }[]
  tags: { id: string; name: string }[]
  options: { id: string; name: string; position: number; isVisual: boolean; values: { id: string; value: string; position: number }[] }[]
  variants: {
    id: string
    sku: string | null
    price: number
    comparePrice: number | null
    isDefault: boolean
    optionValues: { optionValueId: string; value: string }[]
    inStock: boolean
    lowStock: boolean
    // Techo público del stock real (nunca el inventario completo — ver
    // storefront.service.ts) y también el tope real para el carrito: nunca
    // se puede agregar más que esto de una variante.
    maxQty: number
  }[]
  images: { url: string; position: number; isPrimary: boolean; optionValueId: string | null }[]
}

export function getStorefrontProduct(slug: string, id: string) {
  return storefrontRequest<StorefrontProductDetail>(`/${slug}/products/${id}`)
}

// ─── Carrito: revalidar contra la base ──────────────────────────────────────

export type CartValidationItem = {
  variantId: string
  ok: boolean
  motivo?: 'NO_DISPONIBLE' | 'SIN_STOCK' | 'STOCK_INSUFICIENTE'
  nombre: string | null
  variante: string | null
  precio: number | null
  precioAnt: number | null
  maxQty: number
  imgUrl: string | null
}

// `ticketDiscount`: descuento automático (RBT-613) de alcance TICKET (toda la
// compra, no un producto puntual) — a diferencia de `precio`/`precioAnt` por
// ítem (que ya vienen descontados si corresponde), esto no tiene dónde
// "esconderse" en una línea sola, así que viaja aparte.
// `coupon`: estado del código pasado en `couponCode` (si vino uno) — permite
// mostrar "cupón inválido: <motivo>" apenas se aplica, sin esperar a que el
// cliente confirme la compra para enterarse (ver CartContext.revalidar()).
export type CartValidationResponse = {
  items: CartValidationItem[]
  // esPorcentaje/valor: la TASA que produjo `monto` (1% vs $120 fijo) — sin
  // esto la pantalla solo podía mostrar el resultado final, nunca CÓMO se
  // llegó a él (pedido explícito: "necesito que se vea el porcentaje de
  // descuento que se está aplicando").
  ticketDiscount: { nombre: string; monto: number; esPorcentaje: boolean; valor: number } | null
  coupon: { ok: true; code: string; name: string } | { ok: false; reason: string } | null
}

export function validateCart(slug: string, items: { variantId: string; quantity: number }[], couponCode?: string) {
  // Único llamado de este archivo que manda Authorization: si hay sesión de
  // cliente, el backend puede chequear el tope de usos POR CLIENTE de un
  // cupón (maxUsesPerCustomer) al previsualizar — sin esto, ese chequeo
  // recién se hacía al confirmar la compra (checkoutStorefront() sí manda
  // token, vía el BFF). El resto de este archivo sigue sin auth a propósito.
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  return storefrontRequest<CartValidationResponse>(`/${slug}/cart/validate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ items, couponCode: couponCode?.trim() || undefined }),
  })
}

// ─── Pedido: seguimiento público (guest checkout, sin sesión) ──────────────
// Mismo shape que devuelve GET /me/orders/:id (MeOrderDetail, en lib/api.ts —
// el backend reusa el mismo OrdersService.findOne() para las dos rutas), acá
// sin auth: con `email` si es un pedido de invitado (tiene que matchear
// OnlineOrderDetails.buyerEmail), sin `email` si hay sesión de cliente (el
// backend valida contra el token). 404 en cualquier mismatch.
export type OrderTrackingDetail = MeOrderDetail

export function getOrderTracking(slug: string, orderId: string, email?: string) {
  const qs = email ? `?email=${encodeURIComponent(email)}` : ''
  return storefrontRequest<OrderTrackingDetail>(`/${slug}/orders/${orderId}/tracking${qs}`)
}

// ─── Categorías ─────────────────────────────────────────────────────────────

export type StorefrontCategoryItem = {
  id: string
  name: string
  slug: string
  icon: string | null
  color: string | null
  parentId: string | null
  productCount: number
}

export function getStorefrontCategories(slug: string) {
  return storefrontRequest<StorefrontCategoryItem[]>(`/${slug}/categories`)
}

// ─── Cupón por código ───────────────────────────────────────────────────────
// La vista de listado público de cupones (CuponesPublicos.tsx) se sacó — la
// única forma de aplicar un cupón ahora es tipeando el código a mano (en el
// carrito o en el checkout) o entrando por un link de descuento exclusivo.
// El endpoint de listado (`GET /storefront/:slug/coupons`) sigue existiendo
// en el backend por si algo más lo necesita, pero el frontend ya no lo llama.

export type StorefrontCoupon = {
  code: string
  name: string
  type: string // DiscountType del backend (PERCENT_* / AMOUNT_*)
  value: number
  minAmount: number | null
  endDate: string | null // ISO
  categories: string[]
  // Solo lo trae exclusiveDiscount() — DiscountScope del backend
  // ('PRODUCT' | 'CATEGORY' | 'TICKET').
  scope?: string
}

// Resuelve UN código puntual (tipeado a mano o por link directo) — sirve
// tanto para cupones privados (el caso de uso real de "descuento exclusivo")
// como públicos. 404 si no existe, está desactivado, vencido o agotado.
export function getStorefrontExclusiveDiscount(slug: string, code: string) {
  return storefrontRequest<StorefrontCoupon>(`/${slug}/exclusive-discount/${encodeURIComponent(code)}`)
}

// ─── Descuento compartido (sin código — ver DescuentoCompartido.tsx) ──────

export type StorefrontDiscountLanding = {
  id: string
  name: string
  type: string
  value: number
  minAmount: number | null
  endDate: string | null
  categories: string[]
  scope: string // 'PRODUCT' | 'CATEGORY' | 'TICKET'
}

// Resuelve un DESCUENTO (no cupón) por id, para el link compartible que
// genera el dueño desde DescuentosCrear.tsx. 404 si no existe, no tiene el
// link activo, está desactivado, vencido o agotado.
export function getStorefrontDiscountLanding(slug: string, id: string) {
  return storefrontRequest<StorefrontDiscountLanding>(`/${slug}/discounts/${encodeURIComponent(id)}`)
}

// ─── Adaptadores (respuesta real → tipos locales del storefront) ──────────

// Sin `hue` real del backend (es un placeholder de diseño): se deriva uno
// estable a partir del id, así el mismo producto/categoría siempre cae en el
// mismo color mientras no tenga foto.
function hueFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return h
}

const NUEVO_DIAS = 7

export function toTiendaConfig(config: StorefrontConfigResponse): TiendaConfig {
  return {
    nombre: config.appearance?.storeName ?? config.business.name,
    sub: config.appearance?.tagline ?? '',
    slug: config.business.subdomain,
    dominio: `${config.business.subdomain}.${ROOT_DOMAIN}`,
    wpp: config.contact?.whatsapp ?? '',
    email: config.contact?.email ?? '',
  }
}

export function toCategoria(c: StorefrontCategoryItem): Categoria {
  return { id: c.id, nombre: c.name, count: c.productCount, hue: hueFromId(c.id), icon: c.icon, color: c.color }
}

// El backend no tiene un campo "descripción" para el cupón — se usa el `name`.
const SCOPE_A_ALCANCE: Record<string, Cupon['alcance']> = {
  PRODUCT: 'producto',
  CATEGORY: 'categoria',
  TICKET: 'ticket',
}

export function toCupon(c: StorefrontCoupon): Cupon {
  return {
    codigo: c.code,
    tipo: c.type.startsWith('PERCENT') ? 'porcentaje' : 'monto',
    valor: c.value,
    descripcion: c.name,
    minCompra: c.minAmount ?? undefined,
    vencimiento: c.endDate
      ? new Date(c.endDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
      : undefined,
    categorias: c.categories.length ? c.categories : undefined,
    alcance: c.scope ? SCOPE_A_ALCANCE[c.scope] : undefined,
  }
}

export function toOferta(d: StorefrontDiscountLanding): Oferta {
  return {
    id: d.id,
    tipo: d.type.startsWith('PERCENT') ? 'porcentaje' : 'monto',
    valor: d.value,
    descripcion: d.name,
    minCompra: d.minAmount ?? undefined,
    vencimiento: d.endDate
      ? new Date(d.endDate).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
      : undefined,
    categorias: d.categories.length ? d.categories : undefined,
    alcance: SCOPE_A_ALCANCE[d.scope] ?? 'ticket',
  }
}

// Los toggles "Insignia de producto nuevo"/"Insignia de oferta" de Apariencia
// (showNewBadge/showOfferBadge) gatean si el badge se MUESTRA — el cálculo
// de si el producto ES nuevo/está en oferta no cambia. Default true (se
// muestran) si todavía no se cargó la config, mismo criterio "fail-open" que
// el resto del storefront.
export function toProducto(
  p: StorefrontProductItem | StorefrontProductDetail,
  badges?: { showNew?: boolean; showOffer?: boolean; showLowStock?: boolean },
): Producto {
  const esNuevo = 'createdAt' in p && Date.now() - new Date(p.createdAt).getTime() < NUEVO_DIAS * 24 * 60 * 60 * 1000
  const enOferta = p.comparePrice !== null && p.comparePrice > p.price
  const imageUrl = 'imageUrl' in p ? p.imageUrl : (p.images[0]?.url ?? null)
  // Segunda foto real, para el hover de la card (ver Producto.imgUrl2). En
  // el listado `images` ya viene ordenada [principal, ...resto] (backend,
  // orderedImageUrls()), así que el índice 1 es literalmente "la otra
  // foto". En el detalle (relacionados de ProductoDetalle.tsx) no hay esa
  // garantía de orden, así que ahí alcanza con cualquier no-principal.
  const imageUrl2 = 'imageUrl' in p ? (p.images[1] ?? null) : (p.images.find(i => !i.isPrimary)?.url ?? null)
  const inStock = 'inStock' in p ? p.inStock : p.variants.some(v => v.inStock)
  const bajoStock = 'inStock' in p ? p.lowStock : p.variants.some(v => v.lowStock)
  const showOffer = badges?.showOffer ?? true
  const showNew = badges?.showNew ?? true
  const showLowStock = badges?.showLowStock ?? true
  return {
    id: p.id,
    nombre: p.name,
    cat: p.categoryName ?? '',
    precio: p.price,
    precioAnt: enOferta ? p.comparePrice : null,
    badge: (enOferta && showOffer) ? 'Oferta' : (esNuevo && showNew) ? 'Nuevo' : null,
    hue: hueFromId(p.id),
    stock: inStock,
    lowStock: bajoStock && showLowStock,
    imgUrl: imageUrl,
    imgUrl2: imageUrl2,
    // Solo viene en el listado (StorefrontProductItem) — el detalle
    // (StorefrontProductDetail) no se usa hoy para armar una ProductCard.
    variantOptions: 'variantOptions' in p ? p.variantOptions : [],
  }
}

// ─── Arrepentimiento / Devolución / Garantía (RBT-683, botón del footer) ───
// Sin auth, un solo POST que devuelve el número de trámite — no hay estados
// ni "mis solicitudes": la resolución del caso queda 100% fuera de Órbita,
// coordinada por email/WhatsApp directo entre cliente y comercio (ver
// ReturnRequestsService en el backend).

export type ReturnRequestReason = 'ARREPENTIMIENTO' | 'GARANTIA' | 'OTRO'

export type CreateReturnRequestInput = {
  orderNumber: string
  email: string
  phone?: string
  reason: ReturnRequestReason
  comment?: string
}

export function createReturnRequest(slug: string, input: CreateReturnRequestInput) {
  return storefrontRequest<{ trackingNumber: string }>(`/${slug}/return-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

// ─── Prueba social (paquete Avanzado) ──────────────────────────────────────
// Sin auth. null = el negocio no tiene el toggle prendido (o no tiene el
// add-on) — el storefront no muestra nada. Los eventos SIEMPRE son pedidos
// reales de la tienda (ver SocialProofService en el backend): nunca hay un
// mensaje inventado acá.
export type StorefrontSocialProofEvent = { id: string; firstName: string; lastInitial: string; productName: string; occurredAt: string }
export type StorefrontSocialProofFeed = { position: 'BOTTOM_LEFT' | 'BOTTOM_RIGHT'; events: StorefrontSocialProofEvent[] }

export function getSocialProofFeed(slug: string) {
  return storefrontRequest<StorefrontSocialProofFeed | null>(`/${slug}/social-proof/recent`)
}

// ─── Countdown (paquete Avanzado) ───────────────────────────────────────────
// Sin auth, sin config propia — se deriva 100% del descuento más urgente con
// "link compartible" activado en Descuentos (ver CountdownService en el
// backend). null = no hay nada que mostrar (sin el add-on, o sin ningún
// descuento vigente con esa vía prendida).
export type StorefrontActiveCountdown = {
  id: string
  name: string
  type: 'PERCENT_PRODUCT' | 'AMOUNT_PRODUCT' | 'PERCENT_TICKET' | 'AMOUNT_TICKET' | string
  value: number
  scope: 'PRODUCT' | 'CATEGORY'
  endDate: string
}

export function getActiveCountdown(slug: string) {
  return storefrontRequest<StorefrontActiveCountdown | null>(`/${slug}/countdown/active`)
}

// ─── Reseñas (listado público, sin auth) ────────────────────────────────────
// No vive bajo /storefront/:slug (el backend la resuelve directo por
// productId, sin slug de por medio) — por eso pega a `${API_BASE}/products`
// en vez de usar storefrontRequest.
export type StorefrontProductReview = {
  id: string
  productId: string
  text: string
  isVerified: boolean
  createdAt: string
  customerName: string
}
export async function getProductReviews(productId: string): Promise<StorefrontProductReview[]> {
  const res = await fetch(`${API_BASE}/products/${productId}/reviews`)
  const isJson = res.headers.get('content-type')?.includes('application/json')
  const body = isJson ? await res.json().catch(() => null) : null
  if (!res.ok) {
    const message = body?.message ?? body?.error ?? `Error ${res.status}`
    throw new StorefrontApiError(res.status, Array.isArray(message) ? message.join(', ') : message)
  }
  return body as StorefrontProductReview[]
}

// ─── Juegos con premio (paquete Avanzado, Fase 2.2) ─────────────────────────
// Mismo criterio que validateCart(): sin auth por default (jugar sin cuenta
// es válido), pero si hay sesión de cliente se manda el token — el backend
// lo usa para reclamar el premio de una sin pasar por el login con Google.
function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export type GameStartResponse = {
  sessionId: string
  gameName: string | null
  percentPerWin: number
  maxPercent: number
  timeLimitMs: number
  maxAttempts: number
}

export function startGameSession(slug: string, type: string) {
  return storefrontRequest<GameStartResponse>(`/${slug}/games/${type}/start`, { method: 'POST', headers: authHeaders() })
}

// Juegos activos de este negocio — lo usa Inicio.tsx para mostrar (o no) el
// aviso "Jugá y ganá" en el home. Sin auth, es de lectura pública.
// maxPercent/maxAttempts se usan en la pantalla de intro del juego para
// anunciar el premio antes de jugar ("N rondas · hasta X% OFF").
export type ActiveGame = { type: string; name: string | null; campaignVersion: number; maxPercent: number; maxAttempts: number }
export function getActiveGames(slug: string) {
  return storefrontRequest<ActiveGame[]>(`/${slug}/games/active`)
}

// Modal de anuncios activo (paquete "Avanzado") — hermano más simple de
// ActiveGame: un solo modal (no una lista), sin auth, lectura pública.
// `null` = el negocio no tiene ninguno activo/vigente ahora mismo.
export type ActivePromoModal = {
  title: string
  message: string | null
  badge: string | null
  code: string | null
  ctaText: string | null
  ctaLink: string | null
  campaignVersion: number
}
export function getActivePromoModal(slug: string) {
  return storefrontRequest<ActivePromoModal | null>(`/${slug}/promo-modal/active`)
}

export type GameFinishResponse = {
  status: 'WON' | 'LOST' | 'CLAIMED'
  discountPercent: number | null
  code: string | null
  // Vencimiento del cupón — dura lo mismo que la vigencia del juego en el
  // que se ganó (null = sin vencimiento, el juego no tenía vigencia cargada).
  expiresAt: string | null
}

export function finishGameSession(slug: string, sessionId: string, hits: number) {
  return storefrontRequest<GameFinishResponse>(`/${slug}/games/finish`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ sessionId, hits }),
  })
}

export type GameClaimResponse = { code: string; discountPercent: number; expiresAt: string | null }

export function claimGameSession(slug: string, sessionId: string) {
  return storefrontRequest<GameClaimResponse>(`/${slug}/games/claim`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ sessionId }),
  })
}
