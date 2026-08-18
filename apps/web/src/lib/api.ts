// (Fase 1 - Alex) Traigo el "fetch con sesion" que armaron los chicos para el
// login: se encarga solo de mandar el token y de renovarlo cuando se vence.
// Lo usan mis funciones del panel que estan al final de este archivo.
import { authedFetch } from '@/lib/auth/authClient'
import type { MetricasResumen, MetricasFiltros } from '@/modules/ventas/panel/descuentos/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

// ─── Sesión de onboarding (localStorage) ───────────────────────────────────
// No hay todavía un manejo de sesión global en el frontend — esto es
// deliberadamente mínimo: guarda lo que el wizard de onboarding necesita para
// seguir autenticado entre pasos/recargas mientras el negocio sigue en
// borrador (isActive: false). Ver PENDIENTES.md.

const TOKEN_KEY = 'orbita_onboarding_token'
const BUSINESS_ID_KEY = 'orbita_onboarding_business_id'
const BRANCH_ID_KEY = 'orbita_onboarding_branch_id'

export function getOnboardingSession() {
  if (typeof window === 'undefined') return null
  const token = localStorage.getItem(TOKEN_KEY)
  const businessId = localStorage.getItem(BUSINESS_ID_KEY)
  const branchId = localStorage.getItem(BRANCH_ID_KEY)
  if (!token || !businessId || !branchId) return null
  return { token, businessId, branchId }
}

export function setOnboardingSession(session: { token: string; businessId: string; branchId: string }) {
  localStorage.setItem(TOKEN_KEY, session.token)
  localStorage.setItem(BUSINESS_ID_KEY, session.businessId)
  localStorage.setItem(BRANCH_ID_KEY, session.branchId)
}

export function clearOnboardingSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(BUSINESS_ID_KEY)
  localStorage.removeItem(BRANCH_ID_KEY)
}

// ─── Fetch wrapper ──────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = getOnboardingSession()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (session?.token) headers['Authorization'] = `Bearer ${session.token}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const isJson = res.headers.get('content-type')?.includes('application/json')
  const body = isJson ? await res.json().catch(() => null) : null

  if (!res.ok) {
    const message = body?.message ?? body?.error ?? `Error ${res.status}`
    throw new ApiError(res.status, Array.isArray(message) ? message.join(', ') : message)
  }
  return body as T
}

// ─── Onboarding ─────────────────────────────────────────────────────────────

export type Subrubro = { key: string; icon: string; label: string; descripcion: string; tipo: string }
export type Rubro = { key: string; icon: string; label: string; descripcion: string; categoria: string; disponible: boolean; subrubros: Subrubro[] }
export type Categoria = { key: string; label: string; icon: string }

export function getRubrosCatalog() {
  return request<{ categorias: Categoria[]; rubros: Rubro[] }>('/onboarding/rubros')
}

export async function checkSubdomain(subdomain: string) {
  return request<{ available: boolean; reason?: string }>(
    `/onboarding/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`,
  )
}

export async function checkEmail(email: string) {
  return request<{ available: boolean; reason?: string }>(
    `/onboarding/check-email?email=${encodeURIComponent(email)}`,
  )
}

// Multipart — no puede pasar por request() porque el navegador necesita
// setear el Content-Type con el boundary correcto, no application/json.
export async function uploadLogo(file: Blob, filename: string) {
  const session = getOnboardingSession()
  const form = new FormData()
  form.append('file', file, filename)
  const res = await fetch(`${API_BASE}/business/storefront-config/logo`, {
    method: 'POST',
    headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
    body: form,
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const message = body?.message ?? body?.error ?? `Error ${res.status}`
    throw new ApiError(res.status, Array.isArray(message) ? message.join(', ') : message)
  }
  return body as { logoUrl: string }
}

// El logo se guarda en el wizard como data-URI (preview local) — hay que
// convertirlo a Blob recién al subirlo, cuando el pago se aprueba.
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/data:(.*);base64/)?.[1] ?? 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export type RegisterBusinessInput = {
  ownerName: string
  email: string
  password: string
  businessName: string
}

export type RegisterBusinessResult = {
  token: string
  business: { id: string; name: string; subdomain: string; mode: string; isActive: boolean }
  branch: { id: string; name: string }
  member: { id: string; name: string; email: string }
}

export function registerBusiness(input: RegisterBusinessInput) {
  return request<RegisterBusinessResult>('/onboarding/register-business', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

// Datos acumulados client-side durante todo el wizard (sin auth todavía — la
// cuenta recién se crea en el último paso). Ver PENDIENTES.md: se decidió no
// pedir cuenta al entrar al onboarding, solo al terminarlo.
export type WizardData = {
  rubro: string
  subrubros: string[]
  nombre: string
  descripcion: string
  telefono: string
  subdominio: string
  modoVenta: 'ecommerce' | 'vidriera' | ''
  direccion: string
  latLng: [number, number]
  operatesPhysical: boolean
  operatesOnline: boolean
  pagos: string[]
  transferAlias: string
  teamSize: string
  // Credenciales del dueño (paso "Tu cuenta") — NO se crea la cuenta acá.
  // Se retienen client-side hasta que el pago se aprueba en plan.tsx. La
  // contraseña se excluye deliberadamente de la persistencia en localStorage
  // (ver useOnboardingStore.ts, partialize) para no dejarla en texto plano
  // en el navegador más tiempo del necesario.
  ownerName: string
  ownerEmail: string
  ownerPassword: string
  // Preview local del logo (data-URI) — igual que la contraseña, se excluye
  // de la persistencia en localStorage (puede pesar varios MB en base64).
  // Se sube recién si el pago se aprueba, ver plan.tsx.
  logoDataUrl: string
}

// Crea la cuenta + el negocio recién cuando el pago se aprobó, y de
// inmediato guarda todo lo acumulado durante el wizard (subrubros, negocio,
// ubicación, pagos, equipo) usando el token recién emitido. Si el usuario
// nunca paga, nada de esto se llama — no queda ningún registro en la base
// (ver PENDIENTES.md: "retener los datos hasta que el usuario pague").
// Si algún paso de guardado falla después de crear la cuenta, no se
// revierte — el usuario ya tiene sesión y puede reintentar desde el panel
// (el negocio real ya existe, ver `GET /business`).
export async function completeOnboarding(
  account: RegisterBusinessInput,
  wizard: WizardData,
): Promise<RegisterBusinessResult> {
  const result = await registerBusiness(account)
  setOnboardingSession({ token: result.token, businessId: result.business.id, branchId: result.branch.id })

  const tareas: Promise<unknown>[] = [
    updateOnboardingBusiness({
      industry: wizard.rubro,
      subrubros: wizard.subrubros,
      description: wizard.descripcion,
      subdomain: wizard.subdominio || undefined,
      ...(wizard.modoVenta ? { mode: wizard.modoVenta === 'vidriera' ? 'SHOWCASE' : 'FULL' } : {}),
      operatesPhysical: wizard.operatesPhysical,
      operatesOnline: wizard.operatesOnline,
      ...(wizard.teamSize ? { teamSize: wizard.teamSize } : {}),
    }),
    updateBusinessConfig({
      // El contacto público arranca con el mismo email de la cuenta del
      // dueño (no se pide dos veces en el wizard) — se puede cambiar
      // después desde configuración si el negocio quiere uno distinto.
      email: account.email,
      whatsapp: wizard.telefono || undefined,
      acceptsCash: wizard.pagos.includes('efectivo'),
      acceptsTransfer: wizard.pagos.includes('transferencia'),
      acceptsMercadopago: wizard.pagos.includes('mercadopago'),
      acceptsCard: wizard.pagos.includes('tarjeta'),
      ...(wizard.pagos.includes('transferencia') ? { transferAlias: wizard.transferAlias } : {}),
    }),
  ]
  if (wizard.operatesPhysical) {
    tareas.push(updateBranch(result.branch.id, {
      address: wizard.direccion || undefined,
      latitude: wizard.latLng[0],
      longitude: wizard.latLng[1],
    }))
  }
  await Promise.all(tareas)

  return result
}

export type UpdateOnboardingBusinessInput = Partial<{
  name: string
  industry: string
  description: string
  subdomain: string
  mode: 'FULL' | 'SHOWCASE'
  subrubros: string[]
  teamSize: string
  operatesPhysical: boolean
  operatesOnline: boolean
}>

export function updateOnboardingBusiness(input: UpdateOnboardingBusinessInput) {
  return request('/onboarding/business', { method: 'PUT', body: JSON.stringify(input) })
}

export function getBusiness() {
  return request<{
    id: string; name: string; industry: string; description: string | null
    subdomain: string; mode: string; isActive: boolean; isPaused: boolean
    subrubros: string[]; teamSize: string | null
    operatesPhysical: boolean; operatesOnline: boolean
  }>('/business')
}

export type UpdateBranchInput = Partial<{
  name: string
  address: string
  latitude: number
  longitude: number
  isActive: boolean
}>

export function updateBranch(branchId: string, input: UpdateBranchInput) {
  return request(`/branches/${branchId}`, { method: 'PUT', body: JSON.stringify(input) })
}

export type UpdateBusinessConfigInput = Partial<{
  whatsapp: string
  email: string
  acceptsMercadopago: boolean
  acceptsCash: boolean
  acceptsTransfer: boolean
  acceptsCard: boolean
  acceptsPickup: boolean
  transferAlias: string
  // (Fase 1 — Config, Alex) Le agrego los campos que la pantalla de Configuración
  // necesita (horario, envíos, redes). Solo suma campos: no cambia nada de lo que ya había.
  scheduleText: string
  shippingBase: number
  freeShippingFrom: number
  deliveryZones: string[]
  shippingPolicy: string
  instagram: string
  tiktok: string
  facebook: string
}>

export function updateBusinessConfig(input: UpdateBusinessConfigInput) {
  return request('/business/config', { method: 'PUT', body: JSON.stringify(input) })
}

export function getBusinessConfig() {
  return request<{
    whatsapp: string | null; email: string | null; scheduleText: string | null
    acceptsMercadopago: boolean; acceptsCash: boolean; acceptsTransfer: boolean
    acceptsCard: boolean; acceptsPickup: boolean; transferAlias: string | null
    // Ojo: los montos de plata llegan del backend como texto, no como número.
    shippingBase: string | number | null; freeShippingFrom: string | number | null
    deliveryZones: string[]; shippingPolicy: string | null
    instagram: string | null; tiktok: string | null; facebook: string | null
  }>('/business/config')
}

export function publishBusiness() {
  return request<{ url: string; published: boolean }>('/business/publish', { method: 'POST' })
}

// ─── Suscripción a Órbita (cobro del plan al dueño) ─────────────────────────
// Es el cobro NEGOCIO → ÓRBITA, no los pagos de los clientes al negocio.
//
// Nada de esto usa la sesión de onboarding: todavía no existe ninguna cuenta
// en este punto del wizard. Los datos viajan tal cual al backend, que los
// guarda en una tabla temporal (PendingSignup) hasta que MP confirme el
// pago — recién ahí se crea Business/Member de verdad (ver
// SubscriptionsService.confirmAndCreate en el backend). Si el pago nunca se
// confirma, no queda ningún rastro en la base más que esa fila temporal, que
// expira sola.

// Pide el link de MercadoPago donde el dueño autoriza el débito automático,
// mandando junto los datos de la cuenta + todo lo completado en el wizard.
export function startPendingCheckout(account: RegisterBusinessInput, wizard: WizardData) {
  return request<{ preapprovalId: string; initPoint: string }>('/subscription/checkout', {
    method: 'POST',
    body: JSON.stringify({
      account,
      wizard: {
        rubro: wizard.rubro,
        subrubros: wizard.subrubros,
        descripcion: wizard.descripcion,
        telefono: wizard.telefono,
        subdominio: wizard.subdominio,
        modoVenta: wizard.modoVenta,
        direccion: wizard.direccion,
        latitude: wizard.latLng[0],
        longitude: wizard.latLng[1],
        operatesPhysical: wizard.operatesPhysical,
        operatesOnline: wizard.operatesOnline,
        pagos: wizard.pagos,
        transferAlias: wizard.transferAlias,
        teamSize: wizard.teamSize,
        logoDataUrl: wizard.logoDataUrl || undefined,
      },
    }),
  })
}

// ─── Panel: Configuración general (Fase 1 — Alex) ───────────────────────────
// Estas funciones son las que usa la pantalla Configuración del panel para leer
// y guardar los datos de verdad del negocio.
//
// Usan la sesión REAL del login (la que armaron los chicos), no la del wizard de
// registro que está más arriba — esa queda solo para el wizard. Cuando estén
// andando los subdominios capaz haya que ajustar cómo se conectan al backend;
// lo dejé anotado en PENDIENTES.md.

// Ayudante que usan todas las funciones de abajo: hace el pedido al backend con
// la sesión puesta y, si algo falla, arma el error con el mensaje para la pantalla.
async function panelRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await authedFetch(`${API_BASE}${path}`, options)
  const isJson = res.headers.get('content-type')?.includes('application/json')
  const body = isJson ? await res.json().catch(() => null) : null
  if (!res.ok) {
    const message = body?.message ?? body?.error ?? `Error ${res.status}`
    throw new ApiError(res.status, Array.isArray(message) ? message.join(', ') : message)
  }
  return body as T
}

export function panelGetBusiness() {
  return panelRequest<{
    id: string; name: string; industry: string; description: string | null
    subdomain: string; mode: string; isActive: boolean; isPaused: boolean
    subrubros: string[]; teamSize: string | null
    operatesPhysical: boolean; operatesOnline: boolean
  }>('/business')
}

export function panelGetBusinessConfig() {
  return panelRequest<{
    whatsapp: string | null; email: string | null; scheduleText: string | null
    acceptsMercadopago: boolean; acceptsCash: boolean; acceptsTransfer: boolean
    acceptsCard: boolean; acceptsPickup: boolean; transferAlias: string | null
    // Ojo: los montos de plata llegan del backend como texto, no como número.
    shippingBase: string | number | null; freeShippingFrom: string | number | null
    deliveryZones: string[]; shippingPolicy: string | null
    instagram: string | null; tiktok: string | null; facebook: string | null
  }>('/business/config')
}

export function panelUpdateBusinessConfig(input: UpdateBusinessConfigInput) {
  return panelRequest('/business/config', { method: 'PUT', body: JSON.stringify(input) })
}

export type UpdateBusinessInput = Partial<{
  name: string
  industry: string
  description: string
}>

// Guarda los datos básicos del negocio (nombre, rubro, descripción).
export function updateBusiness(input: UpdateBusinessInput) {
  return panelRequest<{ id: string; name: string; industry: string; description: string | null }>(
    '/business',
    { method: 'PUT', body: JSON.stringify(input) },
  )
}

// Pausa o reactiva la tienda. Solo el dueño puede hacerlo.
export function pauseBusiness(paused: boolean) {
  return panelRequest<{ isPaused: boolean }>('/business/pause', {
    method: 'POST',
    body: JSON.stringify({ paused }),
  })
}

// ─── Panel: Mercado Pago (OAuth Connect) ────────────────────────────────────
// El negocio conecta SU PROPIA cuenta de MP — la plata de sus ventas entra
// directo a él, Órbita nunca la toca. Ver mercadopago.service.ts (backend).

export function panelGetMercadopagoStatus() {
  return panelRequest<{ connected: boolean; mpUserId: string | null; mpUserName: string | null; scopes: string[] }>('/mercadopago/status')
}

// Devuelve la URL de autorización de MP — se navega ahí con una redirección
// de página completa (no un fetch), el consent real pasa en el dominio de MP.
export function panelGetMercadopagoConnectUrl() {
  return panelRequest<{ authUrl: string }>('/mercadopago/oauth/connect')
}

export function panelDisconnectMercadopago() {
  return panelRequest<{ ok: boolean }>('/mercadopago/oauth/disconnect', { method: 'POST' })
}

// ─── Panel: Apariencia del storefront ───────────────────────────────────────
// Lo que usa Apariencia.tsx para leer/guardar lo que después se refleja en la
// tienda real (ver StorefrontService.getConfig en el backend, que es quien
// realmente sirve estos datos al storefront público).

export type ApiHeroSlide = {
  id: string; titulo: string; subtitulo: string; img: string | null; cta: string; ctaLink?: string
  imageStyle?: string; imagePosition?: string; bgPattern?: string; bgColor?: string
}
export type ApiHeaderLink = { id: string; label: string; on: boolean }
export type ApiStatsBarItem = { id: string; value: string; label: string }

export type ApiAppearanceConfig = {
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
  // Json? nullable en el schema — un negocio que nunca guardó slides/links
  // los trae en null, no un array vacío.
  heroSlides: ApiHeroSlide[] | null
  headerLinks: ApiHeaderLink[] | null
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
  showStatsBar: boolean
  shippingText: string | null
  whatsappText: string | null
  statsBar: ApiStatsBarItem[] | null
}

export type UpdateAppearanceInput = Partial<Omit<ApiAppearanceConfig, 'colorMode'>> & {
  colorMode?: 'light' | 'dark' | 'system'
}

export function panelGetAppearance() {
  return panelRequest<ApiAppearanceConfig>('/business/storefront-config')
}

export function panelUpdateAppearance(input: UpdateAppearanceInput) {
  return panelRequest<ApiAppearanceConfig>('/business/storefront-config', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

// Genérico: favicon e imágenes de los slides del hero. El logo sigue usando
// uploadLogo() (arriba) porque además escribe storefrontConfig.logoUrl solo.
// removeBackground: solo lo usa el editor de slides — corre el modelo local
// de quitar-fondo (BackgroundRemovalService) antes de convertir a webp.
export async function panelUploadStorefrontImage(
  file: Blob,
  filename: string,
  opts: { removeBackground?: boolean } = {},
) {
  const form = new FormData()
  form.append('file', file, filename)
  if (opts.removeBackground) form.append('removeBackground', 'true')
  const res = await authedFetch(`${API_BASE}/business/storefront-config/upload-image`, { method: 'POST', body: form })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const message = body?.message ?? body?.error ?? `Error ${res.status}`
    throw new ApiError(res.status, Array.isArray(message) ? message.join(', ') : message)
  }
  return body as { url: string }
}

// Cambia el modo de la tienda: completa (con carrito) o solo catálogo. Solo el
// dueño. El backend no deja pasar a solo catálogo con pedidos online sin terminar.
export function changeBusinessMode(mode: 'FULL' | 'SHOWCASE') {
  return panelRequest<{ mode: string }>('/business/mode', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  })
}

// ─── Panel: Equipo → Roles (Fase 1 — tarea 5, Alex) ─────────────────────────
// Con estas funciones la pestaña Roles crea, edita y borra roles de verdad en la
// base. Miembros sigue con datos de muestra: esa parte es de una fase más adelante.

export type ApiPermission = { id: string; group: string; code: string; label: string }
export type ApiRole = {
  id: string; name: string; description: string | null; color: string | null
  isDefault: boolean; permissions: string[]; memberCount: number
}
export type UpsertRoleInput = { name: string; description?: string; color?: string; permissions: string[] }

export function getRoles() { return panelRequest<ApiRole[]>('/roles') }
export function getPermissionsCatalog() { return panelRequest<ApiPermission[]>('/permissions') }
export function createRole(input: UpsertRoleInput) {
  return panelRequest<ApiRole>('/roles', { method: 'POST', body: JSON.stringify(input) })
}
export function updateRole(id: string, input: UpsertRoleInput) {
  return panelRequest<ApiRole>(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}
export function deleteRole(id: string) {
  return panelRequest<{ ok: boolean }>(`/roles/${id}`, { method: 'DELETE' })
}


// ─── Panel: Pedidos (Fase 2 — Alex) ─────────────────────────────────────────
// Las pantallas de pedidos del panel usan estas funciones: la lista con
// filtros, el detalle y el cambio de estado. Mismo mecanismo que Configuración:
// la sesión real del panel.

export type ApiOrderStatus =
  | 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED'

export type ApiOrderSummary = {
  id: string
  orderNumber: number
  channel: 'POS' | 'ONLINE'
  // Quién cargó el pedido: MANUAL (panel) o STOREFRONT (tienda). Es lo que
  // muestran las columnas "Canal" de las listas como Manual/Tienda.
  origin: 'MANUAL' | 'STOREFRONT'
  status: ApiOrderStatus
  customerId: string | null
  customerName: string | null
  customerEmail: string | null
  total: number
  itemCount: number
  items: { productName: string; quantity: number; unitPrice: number }[]
  createdAt: string
}

export type ApiOrdersPage = {
  data: ApiOrderSummary[]
  total: number
  page: number
  limit: number
  // Cuántos pedidos hay en cada estado (para los contadores de las pestañas).
  counts: Partial<Record<ApiOrderStatus, number>>
}

export type ApiOrderDetail = {
  id: string
  orderNumber: number
  fiscalNumber: string | null
  channel: 'POS' | 'ONLINE'
  origin: 'MANUAL' | 'STOREFRONT'
  status: ApiOrderStatus
  customerId: string | null
  customer: { id: string; firstName: string; lastName: string | null; email: string | null } | null
  subtotal: number
  discountTotal: number
  total: number
  notes: string | null
  createdAt: string
  items: {
    id: string; variantId: string; productName: string; variantLabel: string | null
    quantity: number; unitPrice: number; editedPrice: number | null
    discountAmount: number; isConcept: boolean; notes: string | null
  }[]
  payments: { id: string; method: string; status: string; amount: number }[]
  onlineOrderDetails?: {
    buyerName: string; buyerEmail: string; buyerPhone: string | null
    tracking: string | null; shippingCost: number | null
    shippingMethod: 'DELIVERY' | 'PICKUP' | null
    shippingStreet: string | null; shippingFloor: string | null; shippingDepto: string | null
    shippingReferencia: string | null; shippingProvincia: string | null
    shippingCity: string | null; shippingZip: string | null
  } | null
  statusHistory: { status: ApiOrderStatus; createdAt: string }[]
}

export function getOrders(params: {
  status?: ApiOrderStatus
  channel?: 'POS' | 'ONLINE'
  origin?: 'MANUAL' | 'STOREFRONT'
  search?: string
  from?: string
  to?: string
  page?: number
  limit?: number
  // (Postventa) true = solo pedidos con unidades por devolver (el backend
  // filtra por entregado/completado y descarta los ya devueltos enteros).
  returnable?: boolean
} = {}) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  })
  const qs = q.toString()
  return panelRequest<ApiOrdersPage>(`/orders${qs ? `?${qs}` : ''}`)
}

export function getOrder(id: string) {
  return panelRequest<ApiOrderDetail>(`/orders/${id}`)
}

// (Fase 3 — Ale) Email individual al cliente del pedido: asunto y cuerpo
// libres, sale con el layout de marca y queda registrado en la actividad.
export function sendOrderEmail(id: string, subject: string, body: string) {
  return panelRequest<{ sent: boolean; to: string }>(`/orders/${id}/email`, {
    method: 'POST',
    body: JSON.stringify({ subject, body }),
  })
}


// ─── Panel: Devoluciones y notas de crédito (Fase 3 — Ale) ──────────────────
// El circuito completo: la devolución nace desde el wizard del panel, al
// aprobarla el backend reingresa el stock, emite la nota de crédito (si esa
// fue la resolución) y avisa por email. La nota después se aplica como pago.

export type ApiReturnStatus = 'PENDING' | 'IN_PROCESS' | 'APPROVED' | 'REJECTED'
export type ApiRefundMethod = 'CREDIT_NOTE' | 'REFUND'

export type ApiReturn = {
  id: string
  orderId: string
  orderNumber: number
  orderItemId: string | null
  quantity: number
  amount: number
  reason: string
  status: ApiReturnStatus
  refundMethod: ApiRefundMethod
  createdAt: string
  customerName: string | null
  customerEmail: string | null
  productName: string | null
}

export type ApiReturnsPage = {
  data: ApiReturn[]
  total: number
  page: number
  limit: number
  counts: Partial<Record<ApiReturnStatus, number>>
}

export function getReturns(params: { status?: ApiReturnStatus; page?: number; limit?: number } = {}) {
  const q = new URLSearchParams()
  Object.entries(params as Record<string, unknown>).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  })
  const qs = q.toString()
  return panelRequest<ApiReturnsPage>(`/returns${qs ? `?${qs}` : ''}`)
}

export function createReturn(input: {
  orderId: string
  orderItemId?: string
  quantity: number
  amount: number
  reason: string
  refundMethod: ApiRefundMethod
}) {
  return panelRequest<ApiReturn>('/returns', { method: 'POST', body: JSON.stringify(input) })
}

export function updateReturn(id: string, input: { status?: ApiReturnStatus; refundMethod?: ApiRefundMethod; rejectionMessage?: string }) {
  return panelRequest<ApiReturn>(`/returns/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export type ApiCreditNote = {
  id: string
  orderId: string
  orderNumber: number
  returnId: string | null
  customerId: string | null
  customerName: string | null
  customerEmail: string | null
  amount: number
  type: 'BALANCE' | 'REFUND'
  status: 'ISSUED' | 'APPLIED'
  expiresAt: string | null
  createdAt: string
}

export type ApiCreditNotesPage = {
  data: ApiCreditNote[]
  total: number
  page: number
  limit: number
  metrics: { totalEmitido: number; activas: number; porVencer: number; aplicadas: number }
}

export function getCreditNotes(params: { status?: 'ISSUED' | 'APPLIED'; page?: number; limit?: number } = {}) {
  const q = new URLSearchParams()
  Object.entries(params as Record<string, unknown>).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  })
  const qs = q.toString()
  return panelRequest<ApiCreditNotesPage>(`/credit-notes${qs ? `?${qs}` : ''}`)
}

export function createCreditNote(input: {
  orderId: string
  returnId?: string
  customerId?: string
  amount: number
  type: 'BALANCE' | 'REFUND'
}) {
  return panelRequest<ApiCreditNote>('/credit-notes', { method: 'POST', body: JSON.stringify(input) })
}

export function applyCreditNote(id: string) {
  return panelRequest<ApiCreditNote>(`/credit-notes/${id}/apply`, { method: 'PATCH' })
}

export function updateOrderStatus(id: string, status: ApiOrderStatus) {
  return panelRequest<ApiOrderDetail>(`/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}


// ─── Panel: Clientes (Fase 2 — Alex) ────────────────────────────────────────
// La pantalla de clientes usa estas funciones: la lista con sus números
// (pedidos, gastado, ticket, última compra — los calcula el backend mirando
// los pedidos reales) y el detalle con los pedidos del cliente.

export type ApiCustomer = {
  id: string
  firstName: string
  lastName: string | null
  email: string | null
  phone: string | null
  dni: string | null
  hasAccount: boolean
  orderCount: number
  totalSpent: number
  avgTicket: number
  lastOrderAt: string | null
  createdAt: string
}

export type ApiCustomersPage = { data: ApiCustomer[]; total: number; page: number; limit: number }

export type ApiCustomerDetail = ApiCustomer & {
  orders: {
    id: string; orderNumber: number; channel: 'POS' | 'ONLINE'
    status: ApiOrderStatus; total: number; itemCount: number; createdAt: string
  }[]
  addresses: {
    id: string; alias: string | null; street: string; floor: string | null
    city: string; zip: string | null; isDefault: boolean
  }[]
  // Los últimos emails que se le mandaron (alimentan la pestaña Actividad).
  emails: {
    id: string; subject: string; template: string | null
    status: 'SENT' | 'FAILED' | 'SIMULATED'; createdAt: string
  }[]
}

export function getCustomers(params: { search?: string; page?: number; limit?: number } = {}) {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  })
  const qs = q.toString()
  return panelRequest<ApiCustomersPage>(`/customers${qs ? `?${qs}` : ''}`)
}

export function getCustomer(id: string) {
  return panelRequest<ApiCustomerDetail>(`/customers/${id}`)
}


// ─── Panel: catálogo liviano + alta de pedido (Fase 2, tarjeta 4 — Alex) ────
// Lo mínimo que necesita la pantalla "Nuevo pedido": buscar productos del
// catálogo real (con su stock), elegir la variante, y crear el pedido.

export type ApiProductListItem = {
  id: string
  name: string
  basePrice: number
  totalStock: number
  variantCount: number
  primaryImageUrl: string | null
  status: string
}

export function panelGetProducts(params: { search?: string; page?: number; limit?: number } = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  })
  const query = qs.toString()
  return panelRequest<{ data: ApiProductListItem[]; total: number; page: number; limit: number }>(`/products${query ? `?${query}` : ''}`)
}

export type ApiProductDetail = {
  id: string
  name: string
  basePrice: number
  variants: { id: string; price: number; variantLabel?: string | null }[]
}

export function panelGetProduct(id: string) {
  return panelRequest<ApiProductDetail>(`/products/${id}`)
}

export type CreateOrderInput = {
  // Canal del pedido: es el TIPO de flujo, no quién lo carga. 'ONLINE' es el
  // pedido con ciclo de estados (default, y lo que crea el wizard manual);
  // 'POS' es la venta de caja instantánea — ese flujo hoy NO existe y el
  // backend lo rechaza con 422 (queda tipado por si algún día se construye).
  channel?: 'POS' | 'ONLINE'
  customerId?: string
  // Venta a un comprador sin registrar: el nombre es lo único obligatorio.
  // El email queda opcional (Fase 3 — Ale, 31/07): no todas las ventas
  // anónimas necesitan uno. Si el pedido va a un cliente YA registrado
  // (customerId), el backend igual exige que ESE cliente tenga email cargado.
  buyer?: { name: string; email?: string; phone?: string }
  items: { variantId: string; quantity: number; notes?: string }[]
  notes?: string
  shippingCost?: number
}

// Crea un pedido manual desde el panel: nace "pendiente" y el stock se
// descuenta recién al confirmarlo. Si falta stock, el backend lo rechaza
// con el detalle de qué producto no alcanza.
export function createOrder(input: CreateOrderInput) {
  return panelRequest<ApiOrderDetail>('/orders', {
    method: 'POST',
    body: JSON.stringify({ channel: 'ONLINE', ...input }),
  })
}


// Comprobante del pedido: devuelve la dirección para verlo y, si le paso un
// email, se lo manda al cliente con el detalle de la compra.
export function receiptOrder(id: string, email?: string) {
  return panelRequest<{ url: string; sent: boolean }>(`/orders/${id}/receipt`, {
    method: 'POST',
    body: JSON.stringify(email ? { email } : {}),
  })
}


// Email individual o masivo a clientes. El asunto y el cuerpo admiten
// variables por persona: {nombre}, {email}, {total_gastado}, {ultima_compra}.
export function sendCustomersEmail(customerIds: string[], subject: string, body: string) {
  return panelRequest<{ sent: number }>('/customers/email', {
    method: 'POST',
    body: JSON.stringify({ customerIds, subject, body }),
  })
}


// ─── Panel: catálogo de productos (RBT-301 a RBT-305) ───────────────────────
// Lo que usa el módulo Productos del panel. `panelGetProducts`/`panelGetProduct`
// de más arriba se comparten con la pantalla de alta de pedidos: no cambiar su
// forma sin revisar ese uso.

export type ProductStatus = 'PUBLISHED' | 'DRAFT'

export type ApiProductRow = {
  id: string
  name: string
  description: string | null
  categoryId: string | null
  categoryName: string | null
  basePrice: number
  comparePrice: number | null
  cost: number | null
  status: ProductStatus
  isFeatured: boolean
  totalStock: number
  variantCount: number
  primaryImageUrl: string | null
  // Todas las fotos del producto, la que se ve por default primero — para el
  // carrusel de la vista en grilla. Puede venir vacío si no tiene ninguna.
  images: string[]
  createdAt: string
}

// OUT_OF_STOCK no es un estado del producto en la base: el backend lo traduce
// a "todas las variantes sin stock". Se ofrece como filtro porque es como lo
// piensa el dueño.
export type ProductStatusFilter = ProductStatus | 'OUT_OF_STOCK'

export type ProductListFilters = {
  search?: string
  categoryId?: string
  status?: ProductStatusFilter
  page?: number
  limit?: number
}

export function panelListProducts(filters: ProductListFilters = {}) {
  const qs = new URLSearchParams()
  if (filters.search) qs.set('search', filters.search)
  if (filters.categoryId) qs.set('categoryId', filters.categoryId)
  if (filters.status) qs.set('status', filters.status)
  if (filters.page) qs.set('page', String(filters.page))
  if (filters.limit) qs.set('limit', String(filters.limit))
  const query = qs.toString()
  return panelRequest<{ data: ApiProductRow[]; total: number; page: number; limit: number }>(
    `/products${query ? `?${query}` : ''}`,
  )
}

// Métricas del encabezado. `valorInventario` va a costo; si un producto no
// tiene costo cargado, el backend usa su precio de venta.
export type ApiProductStats = {
  total: number
  publicados: number
  borradores: number
  sinStock: number
  valorInventario: number
}

export function panelGetProductStats() {
  return panelRequest<ApiProductStats>('/products/stats')
}

// Detalle completo: es lo que precarga el wizard cuando se edita.
export type ApiProductFull = {
  id: string
  name: string
  description: string | null
  categoryId: string | null
  basePrice: number
  comparePrice: number | null
  cost: number | null
  status: ProductStatus
  isFeatured: boolean
  tags: { id: string; name: string }[]
  options: { id: string; name: string; position: number; isVisual: boolean; values: { id: string; value: string; position: number }[] }[]
  variants: {
    id: string
    sku: string | null
    price: number
    comparePrice: number | null
    isDefault: boolean
    isActive: boolean
    optionValues: { optionValueId: string; value: string }[]
    stock: { branchId: string; quantity: number; stockMin: number }[]
  }[]
  images: { id: string; url: string; position: number; isPrimary: boolean; optionValueId: string | null }[]
}

export function panelGetProductFull(id: string) {
  return panelRequest<ApiProductFull>(`/products/${id}`)
}

// El orden de `options` importa: cada variante lista sus `optionValues` en la
// misma posición (["M","Negro"] ↔ [Talle, Color]).
export type UpsertProductInput = {
  name: string
  description?: string
  categoryId?: string
  basePrice: number
  comparePrice?: number
  cost?: number
  status?: ProductStatus
  tagIds?: string[]
  options?: { name: string; values: string[]; isVisual?: boolean }[]
  variants: {
    id?: string
    sku?: string
    price: number
    comparePrice?: number
    optionValues: string[]
    // En alta es el stock inicial; al editar una variante que ya existe, es el
    // stock al que tiene que quedar (el backend registra el ajuste).
    initialStock?: number
    stockMin?: number
    // false = esta combinación no se ofrece (se conserva igual, no se borra).
    isActive?: boolean
  }[]
}

export function panelCreateProduct(input: UpsertProductInput) {
  return panelRequest<ApiProductFull>('/products', { method: 'POST', body: JSON.stringify(input) })
}

export type GenerateProductDescriptionInput = {
  name: string
  categoryName?: string
  tags?: string[]
  existingDescription?: string
}

export function panelGenerateProductDescription(input: GenerateProductDescriptionInput) {
  return panelRequest<{ description: string }>('/products/generate-description', { method: 'POST', body: JSON.stringify(input) })
}

export function panelUpdateProduct(id: string, input: UpsertProductInput) {
  return panelRequest<ApiProductFull>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

// Baja lógica: el producto desaparece del panel pero los pedidos históricos
// que lo referencian siguen intactos.
export function panelDeleteProduct(id: string) {
  return panelRequest<{ ok: boolean }>(`/products/${id}`, { method: 'DELETE' })
}

// La copia nace como borrador y con stock en 0.
export function panelDuplicateProduct(id: string) {
  return panelRequest<ApiProductFull>(`/products/${id}/duplicate`, { method: 'POST' })
}

// Estrella de "destacado" en la grilla/tabla — no está en el wizard de
// creación a propósito (ver ProductsService.update() en el backend).
export function panelToggleProductFeatured(id: string, isFeatured: boolean) {
  return panelRequest<{ ok: boolean }>(`/products/${id}/featured`, {
    method: 'PATCH',
    body: JSON.stringify({ isFeatured }),
  })
}

// ── Imágenes ────────────────────────────────────────────────────────────────
// Multipart: no puede pasar por panelRequest() porque el navegador tiene que
// poner el Content-Type con su boundary. Mismo patrón que uploadLogo().
//
// `optionValueId` asocia la imagen a un valor de opción (ej. el color "Negro"),
// así la galería cambia cuando el cliente elige ese color en la tienda.
export type ApiProductImage = {
  id: string
  url: string
  position: number
  isPrimary: boolean
  optionValueId: string | null
}

export async function panelUploadProductImage(
  productId: string,
  file: Blob,
  filename: string,
  opts: { isPrimary?: boolean; optionValueId?: string } = {},
) {
  const form = new FormData()
  form.append('file', file, filename)
  if (opts.isPrimary) form.append('isPrimary', 'true')
  if (opts.optionValueId) form.append('optionValueId', opts.optionValueId)

  const res = await authedFetch(`${API_BASE}/products/${productId}/images`, { method: 'POST', body: form })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const message = body?.message ?? body?.error ?? `Error ${res.status}`
    throw new ApiError(res.status, Array.isArray(message) ? message.join(', ') : message)
  }
  return body as ApiProductImage
}

export function panelDeleteProductImage(productId: string, imageId: string) {
  return panelRequest<{ ok: boolean }>(`/products/${productId}/images/${imageId}`, { method: 'DELETE' })
}

export function panelReorderProductImages(
  productId: string,
  items: { id: string; position: number }[],
  primaryId?: string,
) {
  return panelRequest<{ ok: boolean }>(`/products/${productId}/images/reorder`, {
    method: 'PATCH',
    body: JSON.stringify({ items, ...(primaryId ? { primaryId } : {}) }),
  })
}

// ── Categorías (RBT-305) ────────────────────────────────────────────────────
// Sin `flat` devuelve el árbol armado (cada nodo con sus `children`); con
// `flat=true`, la lista plana que necesitan los selects.

export type ApiCategory = {
  id: string
  name: string
  slug: string
  icon: string | null
  color: string | null
  parentId: string | null
  isActive: boolean
  position: number
  productCount: number
}

export type ApiCategoryNode = ApiCategory & { children: ApiCategoryNode[] }

export function panelGetCategoryTree() {
  return panelRequest<ApiCategoryNode[]>('/categories')
}

export function panelGetCategoriesFlat() {
  return panelRequest<ApiCategory[]>('/categories?flat=true')
}

export type UpsertCategoryInput = {
  name: string
  slug?: string
  icon?: string
  color?: string
  parentId?: string | null
  isActive?: boolean
}

export function panelCreateCategory(input: UpsertCategoryInput) {
  return panelRequest<ApiCategory>('/categories', { method: 'POST', body: JSON.stringify(input) })
}

export function panelUpdateCategory(id: string, input: UpsertCategoryInput) {
  return panelRequest<ApiCategory>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

// El backend responde 422 si la categoría todavía tiene productos o
// subcategorías colgando — ese mensaje se muestra tal cual al usuario.
export function panelDeleteCategory(id: string) {
  return panelRequest<{ ok: boolean }>(`/categories/${id}`, { method: 'DELETE' })
}

// ── Etiquetas ───────────────────────────────────────────────────────────────
// Vienen ordenadas por uso (las más usadas primero) para poder ofrecerlas como
// sugerencia en el wizard y no volver a tipearlas.

export type ApiTag = { id: string; name: string; createdAt: string; usageCount: number }

export function panelGetTags() {
  return panelRequest<ApiTag[]>('/tags')
}

export function panelCreateTag(name: string) {
  return panelRequest<ApiTag>('/tags', { method: 'POST', body: JSON.stringify({ name }) })
}

// ── Reporte de productos ────────────────────────────────────────────────────

export type ApiProductsReport = {
  periodoDias: number
  resumen: { productosVendidos: number; unidadesVendidas: number; importeVendido: number; variantesConVenta: number }
  masVendidos: { id: string; name: string; categoryName: string | null; primaryImageUrl: string | null; unidades: number; importe: number }[]
  sinRotacion: { id: string; name: string; categoryName: string | null; primaryImageUrl: string | null; stock: number }[]
  stockCritico: {
    productId: string; productName: string; variantId: string; sku: string | null
    variantLabel: string | null; primaryImageUrl: string | null; cantidad: number; stockMin: number
  }[]
  porCategoria: { id: string; name: string; productos: number; valor: number }[]
}

export function panelGetProductsReport(days?: number) {
  return panelRequest<ApiProductsReport>(`/reports/products${days ? `?days=${days}` : ''}`)
}

// ── Reporte de ventas (historial de pedidos) ────────────────────────────────
// Los KPIs que encabezan el historial: el mes en curso, el mes pasado y la
// variacion entre ambos (en %, salvo la tasa de cancelacion que va en puntos).

export type ApiSalesReportResumen = {
  ventas: number
  pedidos: number
  ticketPromedio: number
  tasaCancelacion: number
}

export type ApiSalesReport = {
  mes: string
  actual: ApiSalesReportResumen
  anterior: ApiSalesReportResumen
  deltas: ApiSalesReportResumen
}

export function panelGetSalesReport() {
  return panelRequest<ApiSalesReport>('/reports/sales')
}

// ── Dashboard (Fase 4 — Ale) ────────────────────────────────────────────────
// Todo lo que muestra la pantalla de inicio en una sola respuesta: KPIs del
// período elegido con sus deltas, alertas accionables, la serie de la semana,
// los rankings del Top y la actividad reciente.

export type ApiDashboardReport = {
  desde: string
  hasta: string
  kpis: {
    ventas: number
    pedidos: number
    ticketPromedio: number
    clientesNuevos: number
    pedidosPendientes: number
    deltas: { ventas: number; pedidos: number; ticketPromedio: number; clientesNuevos: number }
  }
  alertas: {
    stockCritico: number
    pagosPorConfirmar: number
    pedidosPendientes: number
    pedidosSinAtender: number
  }
  serieSemana: { labels: string[]; valores: number[]; totalAnterior: number }
  top: {
    productos: { id: string; name: string; unidades: number; importe: number }[]
    categorias: { label: string; value: number }[]
    canal: { label: string; value: number }[]
  }
  actividad: {
    id: string
    orderNumber: number
    customerName: string | null
    total: number
    status: ApiOrderStatus
    createdAt: string
  }[]
}

// from/to en formato YYYY-MM-DD (inclusive). Sin parámetros = hoy.
export function panelGetDashboardReport(from?: string, to?: string) {
  const q = new URLSearchParams()
  if (from) q.set('from', from)
  if (to) q.set('to', to)
  const qs = q.toString()
  return panelRequest<ApiDashboardReport>(`/reports/dashboard${qs ? `?${qs}` : ''}`)
}

// ── Reporte de clientes (Fase 4 — Ale) ──────────────────────────────────────
// El segmento lo calcula el backend al leer (vip / recurrente / nuevo /
// inactivo) — no existe un campo guardado en la base.

export type ApiSegmento = 'vip' | 'recurrente' | 'nuevo' | 'inactivo'

export type ApiCustomersReportRow = {
  id: string
  nombre: string
  pedidos: number
  gastado: number
  ultimaCompra: string | null
  creadoEl: string
  segmento: ApiSegmento
}

export type ApiCustomersReport = {
  metricas: {
    activos: number
    nuevosMes: number
    deltaNuevosMes: number
    recurrentesPct: number
    ltvPromedio: number
    totalClientes: number
  }
  nuevosPorSemana: { label: string; value: number }[]
  segmentacion: { segmento: ApiSegmento; cantidad: number }[]
  topClientes: ApiCustomersReportRow[]
  clientes: ApiCustomersReportRow[]
}

export function panelGetCustomersReport() {
  return panelRequest<ApiCustomersReport>('/reports/customers')
}

// ── Búsqueda global del panel (Fase 4 — Ale) ────────────────────────────────
// Un solo pedido que busca en pedidos, clientes, productos y descuentos.
// Cada grupo llega vacío si el miembro no tiene permiso para ver esa sección.

export type ApiSearchResults = {
  query: string
  pedidos: { id: string; orderNumber: number; customerName: string | null; total: number; status: ApiOrderStatus; createdAt: string }[]
  clientes: { id: string; nombre: string; email: string | null; phone: string | null }[]
  productos: { id: string; name: string; basePrice: number; status: string }[]
  descuentos: { id: string; name: string; code: string | null; isActive: boolean; esCupon: boolean }[]
}

export function panelSearch(q: string) {
  return panelRequest<ApiSearchResults>(`/search?q=${encodeURIComponent(q)}`)
}

// ── Equipo: miembros (Fase 4 — Ale) ─────────────────────────────────────────
// La pestaña Miembros de Configuración → Equipo, ahora contra la base real.
// Invitar genera la contraseña temporal en el backend (que además la manda
// por email) y la devuelve para poder copiarla del panel.

export type ApiMember = {
  id: string
  name: string
  email: string
  role: { id: string; name: string }
  status: 'ACTIVE' | 'PENDING'
  hasTempPassword: boolean
  lastAccessAt: string | null
}

export function getMembers() {
  return panelRequest<ApiMember[]>('/members')
}

export function inviteMember(input: { name: string; email: string; roleId: string }) {
  return panelRequest<{ id: string; name: string; email: string; status: string; hasTempPassword: boolean; tempPassword: string }>(
    '/members/invite',
    { method: 'POST', body: JSON.stringify(input) },
  )
}

export function updateMember(id: string, input: { name?: string; roleId?: string }) {
  return panelRequest<ApiMember>(`/members/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function removeMember(id: string) {
  return panelRequest<{ ok: boolean }>(`/members/${id}`, { method: 'DELETE' })
}

// Devuelve la contraseña temporal nueva para copiar; con sendEmail también
// se la manda al miembro por correo.
export function resetMemberPassword(id: string, sendEmail: boolean) {
  return panelRequest<{ tempPassword: string; emailSent: boolean }>(`/members/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ sendEmail }),
  })
}

// ── Preferencias de notificaciones (Fase 4 — Ale) ───────────────────────────
// La matriz evento × canal que consume el motor de notificaciones de Alan.

export type ApiNotificationChannels = { panel: boolean; email: boolean; whatsapp: boolean }
export type ApiNotificationMatrix = Record<string, ApiNotificationChannels>

export function panelGetNotificationConfig() {
  return panelRequest<{ matrix: ApiNotificationMatrix }>('/business/notification-config')
}

export function panelUpdateNotificationConfig(matrix: ApiNotificationMatrix) {
  return panelRequest<{ matrix: ApiNotificationMatrix }>('/business/notification-config', {
    method: 'PUT',
    body: JSON.stringify({ matrix }),
  })
}

// ── Descuentos (RBT-613/614) ────────────────────────────────────────────────
// Solo cubre `code = null` (descuentos, no cupones — RBT-615/616 no tiene
// backend todavía). Los 3 tipos avanzados (BUY_X_PAY_Y/BUY_X_GET_Z/VOLUME) no
// existen del lado del backend: `type`/`scope`/`application` solo listan los
// valores que el backend realmente acepta.

export type ApiDiscountType = 'PERCENT_PRODUCT' | 'AMOUNT_PRODUCT' | 'PERCENT_TICKET' | 'AMOUNT_TICKET'
export type ApiDiscountScope = 'PRODUCT' | 'CATEGORY' | 'TICKET'
export type ApiDiscountApplication = 'AUTOMATIC' | 'MANUAL'
// 'agotado' lo deriva el backend para el badge, pero NO es un valor válido del
// filtro `status` (ver find-discounts-query.dto.ts) — por eso no está en
// DiscountListFilters.status abajo.
export type ApiDiscountEstado = 'activo' | 'inactivo' | 'programado' | 'expirado' | 'agotado'

export type ApiDiscountRow = {
  id: string
  name: string
  type: ApiDiscountType
  value: number
  scope: ApiDiscountScope
  application: ApiDiscountApplication
  alcanceResumen: string
  startDate: string
  endDate: string | null
  recurrente: boolean
  maxUsesTotal: number | null
  usesConsumed: number
  isActive: boolean
  estado: ApiDiscountEstado
  createdAt: string
}

export type ApiDiscountDetail = ApiDiscountRow & {
  productLevel: 'padre' | 'variante' | null
  minQuantity: number | null
  minAmount: number | null
  activeDays: number[]
  startTime: string | null
  endTime: string | null
  maxUsesPerCustomer: number | null
  priority: number
  productIds: string[]
  categoryIds: string[]
  createdBy: string
  updatedAt: string
  linkActive: boolean
}

export type ApiUpsertDiscountInput = {
  name: string
  type: ApiDiscountType
  value: number
  scope: ApiDiscountScope
  productLevel?: 'padre' | 'variante'
  minQuantity?: number
  minAmount?: number
  application?: ApiDiscountApplication
  startDate: string
  endDate?: string
  activeDays?: number[]
  startTime?: string
  endTime?: string
  maxUsesTotal?: number
  maxUsesPerCustomer?: number
  priority?: number
  productIds?: string[]
  categoryIds?: string[]
  linkActive?: boolean
}

export type DiscountListFilters = {
  status?: Exclude<ApiDiscountEstado, 'agotado'>
  type?: ApiDiscountType
  search?: string
  page?: number
  limit?: number
}

export function panelListDiscounts(filters: DiscountListFilters = {}) {
  const qs = new URLSearchParams()
  if (filters.status) qs.set('status', filters.status)
  if (filters.type) qs.set('type', filters.type)
  if (filters.search) qs.set('search', filters.search)
  if (filters.page) qs.set('page', String(filters.page))
  if (filters.limit) qs.set('limit', String(filters.limit))
  const query = qs.toString()
  return panelRequest<{ data: ApiDiscountRow[]; total: number; page: number; limit: number }>(
    `/discounts${query ? `?${query}` : ''}`,
  )
}

export function panelGetDiscount(id: string) {
  return panelRequest<ApiDiscountDetail>(`/discounts/${id}`)
}

export function panelCreateDiscount(input: ApiUpsertDiscountInput) {
  return panelRequest<ApiDiscountDetail>('/discounts', { method: 'POST', body: JSON.stringify(input) })
}

export function panelUpdateDiscount(id: string, input: ApiUpsertDiscountInput) {
  return panelRequest<ApiDiscountDetail>(`/discounts/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

// El backend invierte isActive tal cual está en ese momento (no recibe un
// valor destino) — el switch del panel ya refleja el estado actual, así que
// clickearlo siempre significa "lo contrario de lo que se ve".
export function panelToggleDiscount(id: string) {
  return panelRequest<ApiDiscountDetail>(`/discounts/${id}/toggle`, { method: 'PATCH' })
}

export function panelDeleteDiscount(id: string) {
  return panelRequest<{ ok: boolean }>(`/discounts/${id}`, { method: 'DELETE' })
}

// ── Cupones (RBT-615) ───────────────────────────────────────────────────────
// Cupones = filas de discounts con code≠null. Mismo patrón que descuentos, con
// los campos propios de cupón (code, isPrivate, maxUsesPerCustomer, link).

export type ApiCouponType = 'PERCENT_PRODUCT' | 'AMOUNT_PRODUCT' | 'PERCENT_TICKET' | 'AMOUNT_TICKET'
export type ApiCouponScope = 'PRODUCT' | 'CATEGORY' | 'TICKET'
// 'agotado' lo deriva el backend para el badge, pero NO es filtrable (ver el
// DTO del backend) — por eso queda afuera de CouponListFilters.status.
export type ApiCouponEstado = 'activo' | 'inactivo' | 'programado' | 'expirado' | 'agotado'

export type ApiCouponRow = {
  id: string
  code: string
  name: string
  type: ApiCouponType
  value: number
  scope: ApiCouponScope
  alcanceResumen: string
  startDate: string
  endDate: string | null
  maxUsesTotal: number | null
  maxUsesPerCustomer: number | null
  usesConsumed: number
  isPrivate: boolean
  isActive: boolean
  estado: ApiCouponEstado
  linkActive: boolean
  createdAt: string
}

export type ApiCouponDetail = ApiCouponRow & {
  productLevel: 'padre' | 'variante' | null
  minAmount: number | null
  linkRedirect: string | null
  productIds: string[]
  categoryIds: string[]
  createdBy: string
  updatedAt: string
}

export type ApiUpsertCouponInput = {
  code: string
  name: string
  type: ApiCouponType
  value: number
  scope: ApiCouponScope
  productLevel?: 'padre' | 'variante'
  minAmount?: number
  maxUsesTotal?: number
  maxUsesPerCustomer?: number
  isPrivate?: boolean
  startDate: string
  endDate?: string
  linkActive?: boolean
  linkRedirect?: string
  productIds?: string[]
  categoryIds?: string[]
}

export type CouponListFilters = {
  status?: Exclude<ApiCouponEstado, 'agotado'>
  type?: ApiCouponType
  search?: string
  page?: number
  limit?: number
}

export function panelListCoupons(filters: CouponListFilters = {}) {
  const qs = new URLSearchParams()
  if (filters.status) qs.set('status', filters.status)
  if (filters.type) qs.set('type', filters.type)
  if (filters.search) qs.set('search', filters.search)
  if (filters.page) qs.set('page', String(filters.page))
  if (filters.limit) qs.set('limit', String(filters.limit))
  const query = qs.toString()
  return panelRequest<{ data: ApiCouponRow[]; total: number; page: number; limit: number }>(
    `/coupons${query ? `?${query}` : ''}`,
  )
}

export function panelGetCoupon(id: string) {
  return panelRequest<ApiCouponDetail>(`/coupons/${id}`)
}

export function panelCreateCoupon(input: ApiUpsertCouponInput) {
  return panelRequest<ApiCouponDetail>('/coupons', { method: 'POST', body: JSON.stringify(input) })
}

export function panelUpdateCoupon(id: string, input: ApiUpsertCouponInput) {
  return panelRequest<ApiCouponDetail>(`/coupons/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

// Igual que descuentos: el backend invierte isActive tal cual está.
export function panelToggleCoupon(id: string) {
  return panelRequest<ApiCouponDetail>(`/coupons/${id}/toggle`, { method: 'PATCH' })
}

export function panelDeleteCoupon(id: string) {
  return panelRequest<{ ok: boolean }>(`/coupons/${id}`, { method: 'DELETE' })
}

// Envío libre del link de un cupón exclusivo — a diferencia de
// sendCustomersEmail() (POST /customers/email), NO exige que `to` sea un
// cliente registrado. Puede ser cualquier dirección.
export function sendCouponLinkEmail(to: string, subject: string, body: string) {
  return panelRequest<{ sent: boolean }>('/coupons/link-email', {
    method: 'POST',
    body: JSON.stringify({ to, subject, body }),
  })
}

// ── Métricas de descuentos/cupones ──────────────────────────────────────────
// El backend devuelve exactamente el shape `MetricasResumen` del front (mismas
// keys), así que no hace falta adaptador. Datos reales desde que el checkout
// del storefront escribe DiscountRedemption al confirmar una venta con
// descuento/cupón (RBT-616).
export function panelGetMetrics(filtros: Partial<MetricasFiltros> = {}) {
  const qs = new URLSearchParams()
  if (filtros.rango) qs.set('rango', filtros.rango)
  if (filtros.canal && filtros.canal !== 'todos') qs.set('canal', filtros.canal)
  if (filtros.tipo && filtros.tipo !== 'todos') qs.set('tipo', filtros.tipo)
  if (filtros.fechaDesde) qs.set('fechaDesde', filtros.fechaDesde)
  if (filtros.fechaHasta) qs.set('fechaHasta', filtros.fechaHasta)
  const query = qs.toString()
  return panelRequest<MetricasResumen>(`/discounts/metrics${query ? `?${query}` : ''}`)
}

// ─── Storefront: cuenta del cliente (/me/*) — RBT-628/629/630/631 ────────────
// Mismo transporte que el panel (authedFetch: Bearer en memoria + slug del host,
// con refresh automático). Todo scopeado al customerId del token por el backend.

export type MeProfile = {
  id: string; firstName: string; lastName: string | null; email: string | null
  phone: string | null; dni: string | null; birthDate: string | null
  avatarUrl: string | null; emailVerified: boolean
}
export type MeAddress = {
  id: string; alias: string | null; street: string; floor: string | null
  depto: string | null; referencia: string | null; provincia: string | null
  city: string; zip: string | null; isDefault: boolean
}
export type MeAddressInput = {
  alias?: string; street: string; floor?: string; depto?: string; referencia?: string
  provincia?: string; city: string; zip?: string; isDefault?: boolean
}
export type MeOrderRow = {
  id: string; orderNumber: number; status: string
  subtotal: number; discountTotal: number; total: number; itemCount: number; createdAt: string
}
export type MeOrdersResponse = { data: MeOrderRow[]; resumen: { cantidadPedidos: number; totalGastado: number } }
export type MeSession = {
  id: string; deviceInfo: { userAgent: string | null; ip: string | null } | null
  createdAt: string; expiresAt: string; isCurrent: boolean
}

// Datos personales (RBT-630)
export function meGetProfile() { return panelRequest<MeProfile>('/me') }
export function meUpdateProfile(input: Partial<Pick<MeProfile, 'firstName' | 'lastName' | 'email' | 'phone' | 'dni' | 'birthDate'>>) {
  return panelRequest<MeProfile>('/me', { method: 'PATCH', body: JSON.stringify(input) })
}
export function meChangePassword(input: { currentPassword: string; newPassword: string }) {
  return panelRequest<{ message: string }>('/me/change-password', { method: 'POST', body: JSON.stringify(input) })
}
export async function meUploadAvatar(file: File): Promise<{ avatarUrl: string | null }> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await authedFetch(`${API_BASE}/me/avatar`, { method: 'POST', body: fd })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, body?.message ?? body?.error ?? `Error ${res.status}`)
  return body as { avatarUrl: string | null }
}

// Direcciones (RBT-629)
export function meListAddresses() { return panelRequest<MeAddress[]>('/me/addresses') }
export function meCreateAddress(input: MeAddressInput) { return panelRequest<MeAddress>('/me/addresses', { method: 'POST', body: JSON.stringify(input) }) }
export function meUpdateAddress(id: string, input: MeAddressInput) { return panelRequest<MeAddress>(`/me/addresses/${id}`, { method: 'PUT', body: JSON.stringify(input) }) }
export function meDeleteAddress(id: string) { return panelRequest<{ ok: boolean }>(`/me/addresses/${id}`, { method: 'DELETE' }) }

// Mis pedidos (RBT-628)
export function meListOrders() { return panelRequest<MeOrdersResponse>('/me/orders') }
export type MeOrderDetail = {
  id: string; orderNumber: number; status: string; createdAt: string
  subtotal: number; discountTotal: number; total: number; notes: string | null
  items: { id: string; productName: string; variantLabel: string | null; imgUrl: string | null; quantity: number; unitPrice: number }[]
  onlineOrderDetails: {
    buyerName: string; buyerEmail: string | null; buyerPhone: string | null
    tracking: string | null; shippingAddressId: string | null
    shippingAddress: MeAddress | null
    // Envío a domicilio vs. retiro en local + la dirección en texto plano
    // (snapshot del pedido — ver Comprobante/PedidoDetalle del panel). Puede
    // venir de una Address guardada (copiada acá al confirmar) o tipeada a
    // mano por un invitado — de cualquier forma, siempre está acá.
    shippingMethod: 'DELIVERY' | 'PICKUP' | null
    shippingStreet: string | null; shippingFloor: string | null; shippingDepto: string | null
    shippingReferencia: string | null; shippingProvincia: string | null
    shippingCity: string | null; shippingZip: string | null
  } | null
  // Línea de tiempo real: un renglón por cada cambio de estado (el primero
  // siempre es PENDING, al crearse el pedido). El admin la mueve a mano
  // desde el panel — esto NO es tracking logístico, es el estado del pedido.
  statusHistory: { status: string; createdAt: string }[]
  // Para saber si un pedido PENDING se confirma solo (Mercado Pago, vía
  // webhook) o requiere que el negocio lo confirme a mano (efectivo/
  // transferencia/retiro) — ver Confirmacion.tsx.
  payments: { method: string; status: string }[]
}
export function meGetOrder(id: string) { return panelRequest<MeOrderDetail>(`/me/orders/${id}`) }
export function meCancelOrder(id: string, reason?: string) {
  return panelRequest<MeOrderDetail>(`/me/orders/${id}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason }) })
}
export type MeReturnInput = { orderItemId: string; quantity: number; reason: string }
export function meCreateReturn(orderId: string, input: MeReturnInput) {
  return panelRequest<{ id: string; status: string }>(`/me/orders/${orderId}/return`, { method: 'POST', body: JSON.stringify(input) })
}

// ── Reseñas (cliente logueado) ───────────────────────────────────────────────
// El listado público de reseñas de un producto vive en lib/storefront/api.ts
// (sin auth, @Public()) — esto es solo la parte que necesita sesión: saber si
// PUEDO reseñar y mandar la reseña.
export type ReviewEligibility = { eligible: boolean; orderId: string | null }
export function reviewEligibility(productId: string) {
  return panelRequest<ReviewEligibility>(`/reviews/eligibility?productId=${encodeURIComponent(productId)}`)
}
export type CreateReviewInput = { productId: string; orderId: string; text: string }
export type ProductReview = { id: string; productId: string; text: string; isVerified: boolean; createdAt: string; customerName: string }
export function createReview(input: CreateReviewInput) {
  return panelRequest<ProductReview>('/reviews', { method: 'POST', body: JSON.stringify(input) })
}

// ── Checkout real del storefront (RBT-617/618/619) ──────────────────────────
// A diferencia del resto de lib/storefront/api.ts (sin auth, rutas @Public()),
// esto SÍ necesita el token del cliente logueado — por eso vive acá, con el
// mismo panelRequest/authedFetch que ya usa el resto de /me/*.
// Dirección tipeada a mano (invitados sin cuenta, o un cliente que prefiere
// no guardarla) — mismo shape que MeAddressInput menos alias/isDefault, que
// no aplican acá (no crea una fila de Address, es un snapshot del pedido).
export type CheckoutShippingAddress = {
  street: string; floor?: string; depto?: string; referencia?: string
  provincia?: string; city: string; zip?: string
}
export type CheckoutInput = {
  items: { variantId: string; quantity: number }[]
  // Teléfono obligatorio: el checkout coordina el envío por WhatsApp, sin
  // teléfono no hay forma de contactar al comprador para eso.
  buyer: { name: string; email: string; phone: string }
  // Envío a domicilio vs. retiro en el local — independiente del método de
  // pago (antes 'PICKUP' era un valor de paymentMethod).
  shippingMethod: 'DELIVERY' | 'PICKUP'
  // Con DELIVERY, exactamente una de las dos: shippingAddressId (dirección
  // guardada, cliente con sesión) o shippingAddress (tipeada a mano).
  shippingAddressId?: string
  shippingAddress?: CheckoutShippingAddress
  // 'PICKUP' ya no es un método de pago. Con envío a domicilio, además,
  // 'CASH' no está disponible (el backend lo rechaza igual, pero el
  // frontend ya no lo ofrece).
  paymentMethod: 'CASH' | 'TRANSFER' | 'MERCADOPAGO'
  couponCode?: string
}
export type CheckoutOrder = {
  id: string; orderNumber: number; status: string
  subtotal: number; discountTotal: number; total: number
  notes: string | null; createdAt: string
}
export function checkoutStorefront(slug: string, input: CheckoutInput) {
  return panelRequest<CheckoutOrder>(`/storefront/${slug}/checkout`, { method: 'POST', body: JSON.stringify(input) })
}

// Fase 8: preferencia de pago de Mercado Pago para un pedido ya creado
// (PENDING). Se llama justo después de checkoutStorefront() cuando el
// método elegido es MERCADOPAGO -- separado en dos pasos porque así lo
// define CONTRATO_API.md (POST /mercadopago/orders es su propio endpoint).
export function crearPreferenciaMercadopago(orderId: string) {
  return panelRequest<{ mpOrderId: string; initPoint?: string }>('/mercadopago/orders', {
    method: 'POST', body: JSON.stringify({ orderId }),
  })
}

// ── Mi perfil (panel — dueño/equipo, RBT-646) ────────────────────────────────
// No confundir con meGetProfile/meUpdateProfile de arriba: esas son del
// CLIENTE del storefront (RBT-630), esto es del member/dueño del panel.
export type MemberProfile = {
  id: string; name: string; email: string; emailVerified: boolean
  role: string; themePreference: 'LIGHT' | 'DARK' | 'SYSTEM'
}
export function panelGetProfile() { return panelRequest<MemberProfile>('/member-profile') }
export function panelUpdateProfile(input: { name?: string; email?: string }) {
  return panelRequest<MemberProfile>('/member-profile', { method: 'PATCH', body: JSON.stringify(input) })
}
export function panelUpdateTheme(themePreference: MemberProfile['themePreference']) {
  return panelRequest<MemberProfile>('/member-profile/theme', { method: 'PATCH', body: JSON.stringify({ themePreference }) })
}

// Sesiones (RBT-631) — vía BFF (pages/api/me/sessions/*), no panelRequest
// directo al backend: GET y revoke-all necesitan el refresh token de esta
// pestaña para que el backend marque isCurrent y preserve la sesión en uso,
// y ese token vive en una cookie httpOnly que solo el BFF puede leer.
async function bffRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await authedFetch(path, options)
  const isJson = res.headers.get('content-type')?.includes('application/json')
  const body = isJson ? await res.json().catch(() => null) : null
  if (!res.ok) {
    const message = body?.message ?? body?.error ?? `Error ${res.status}`
    throw new ApiError(res.status, Array.isArray(message) ? message.join(', ') : message)
  }
  return body as T
}
export function meListSessions() { return bffRequest<MeSession[]>('/api/me/sessions') }
export function meRevokeSession(id: string) { return bffRequest<{ ok: boolean }>(`/api/me/sessions/${id}`, { method: 'DELETE' }) }
export function meRevokeAllSessions() { return bffRequest<{ ok: boolean }>('/api/me/sessions/revoke-all', { method: 'POST' }) }

// ── Mensajes: chat cliente↔tienda ────────────────────────────────────────────
// Un hilo único por cliente (no por pedido) — el mismo shape de mensaje lo
// usan el cliente (storefront) y el panel (dueño/staff).
export type ChatMessage = { id: string; sender: 'CUSTOMER' | 'STORE'; text: string; orderId: string | null; createdAt: string }

// Storefront (cliente logueado)
export type MeConversation = { id: string | null; messages: ChatMessage[] }
export function meGetConversation() { return panelRequest<MeConversation>('/me/conversation') }
export function meSendConversationMessage(text: string) {
  return panelRequest<ChatMessage>('/me/conversation/messages', { method: 'POST', body: JSON.stringify({ text }) })
}

// Panel (dueño/staff) — bandeja de todas las conversaciones del negocio
export type ConversationRow = {
  id: string; customerId: string; customerName: string; customerEmail: string | null; customerAvatar: string | null
  isUnread: boolean; isArchived: boolean; lastMessage: ChatMessage | null; updatedAt: string
}
export function listConversations() { return panelRequest<ConversationRow[]>('/conversations') }
export function getConversationMessages(id: string) { return panelRequest<ChatMessage[]>(`/conversations/${id}/messages`) }
export function sendConversationMessage(id: string, input: { text: string; orderId?: string }) {
  return panelRequest<ChatMessage>(`/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify(input) })
}
export function updateConversation(id: string, input: { isUnread?: boolean; isArchived?: boolean }) {
  return panelRequest<{ ok: boolean }>(`/conversations/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}
// Contador liviano para la campana/el menú lateral (RBT-657) — no trae la
// lista completa de conversaciones, solo el número.
export function getUnreadConversationsCount() {
  return panelRequest<{ count: number }>('/conversations/unread-count')
}

// Plantillas de mensaje (RBT-657)
export type MessageTemplateRow = { id: string; name: string; text: string; category: string; createdAt: string; updatedAt: string }
export function listMessageTemplates() { return panelRequest<MessageTemplateRow[]>('/message-templates') }
export function createMessageTemplate(input: { name: string; text: string; category: string }) {
  return panelRequest<MessageTemplateRow>('/message-templates', { method: 'POST', body: JSON.stringify(input) })
}
export function updateMessageTemplate(id: string, input: { name: string; text: string; category: string }) {
  return panelRequest<MessageTemplateRow>(`/message-templates/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}
export function deleteMessageTemplate(id: string) {
  return panelRequest<{ ok: boolean }>(`/message-templates/${id}`, { method: 'DELETE' })
}

// ── Notificaciones (RBT-645 — motor de notificaciones) ──────────────────────

export type ApiNotification = {
  id: string
  event: string
  title: string
  body: string
  level: 'INFO' | 'WARNING' | 'DANGER'
  isRead: boolean
  resourceType: string | null
  resourceId: string | null
  createdAt: string
}

export function panelGetNotifications(params?: { page?: number; limit?: number; unreadOnly?: boolean }) {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.unreadOnly) qs.set('unreadOnly', 'true')
  const suffix = qs.toString() ? `?${qs}` : ''
  return panelRequest<{ data: ApiNotification[]; total: number; page: number; limit: number }>(`/notifications${suffix}`)
}

export function panelGetUnreadNotificationsCount() {
  return panelRequest<{ count: number }>('/notifications/unread-count')
}

export function panelMarkNotificationRead(id: string) {
  return panelRequest<{ ok: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' })
}

export function panelMarkAllNotificationsRead() {
  return panelRequest<{ ok: boolean }>('/notifications/read-all', { method: 'PATCH' })
}
