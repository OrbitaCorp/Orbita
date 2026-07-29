// (Fase 1 - Alex) Traigo el "fetch con sesion" que armaron los chicos para el
// login: se encarga solo de mandar el token y de renovarlo cuando se vence.
// Lo usan mis funciones del panel que estan al final de este archivo.
import { authedFetch } from '@/lib/auth/authClient'

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

// ─── Panel: Apariencia del storefront ───────────────────────────────────────
// Lo que usa Apariencia.tsx para leer/guardar lo que después se refleja en la
// tienda real (ver StorefrontService.getConfig en el backend, que es quien
// realmente sirve estos datos al storefront público).

export type ApiHeroSlide = {
  id: string; titulo: string; subtitulo: string; img: string | null; cta: string; ctaLink?: string
  imageStyle?: string; imagePosition?: string; bgPattern?: string; bgColor?: string
}
export type ApiHeaderLink = { id: string; label: string; on: boolean }

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
  ctaText: string | null
  shippingText: string | null
  whatsappText: string | null
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
  } | null
  statusHistory: { status: ApiOrderStatus; createdAt: string }[]
}

export function getOrders(params: {
  status?: ApiOrderStatus
  channel?: 'POS' | 'ONLINE'
  search?: string
  from?: string
  to?: string
  page?: number
  limit?: number
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

export function panelGetProducts(search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  return panelRequest<{ data: ApiProductListItem[]; total: number }>(`/products${qs}`)
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
  customerId?: string
  buyer?: { name: string; email: string; phone?: string }
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
