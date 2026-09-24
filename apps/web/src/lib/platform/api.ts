// Cliente del super panel (plataforma). Usa authedFetch, que inyecta el access
// token en memoria y refresca solo ante un 401. Pega directo al backend (mismo
// esquema que el resto del panel); al vivir en el apex, currentSlug() es null,
// así que no se manda X-Business-Slug.

import { authedFetch } from '@/lib/auth/authClient'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

// Error con el código HTTP a mano: la pantalla decide qué decir según el
// código. El caso que importa es el 404 de ruta: la API desplegada es más
// vieja que el frontend y todavía no tiene ese módulo (pasó con Soporte el
// 21/09: el panel salió por Vercel antes que la API por Cloud Run). Sin el
// status, el superadmin mostraba "No se pudo cargar" como si fuera una caída.
export class PlatformApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'PlatformApiError'
  }
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await authedFetch(`${API_BASE}${path}`, { method: 'GET' })
  if (!res.ok) throw new PlatformApiError(res.status, `Platform API ${res.status}`)
  return (await res.json()) as T
}

async function sendJSON<T>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const res = await authedFetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    // class-validator devuelve `message` como array cuando falla más de una
    // regla; sin esto el usuario veía "[object Object]" en vez del motivo.
    const msg = (data as { message?: string | string[] })?.message
    throw new PlatformApiError(res.status, Array.isArray(msg) ? msg.join('. ') : (msg ?? `Platform API ${res.status}`))
  }
  return data as T
}

// ─── Tipos (subconjunto de lo que el backend devuelve, lo que se renderiza) ──

// Códigos de descuento de plataforma: los que Órbita le hace a un negocio
// sobre su suscripción (no los que un negocio le hace a sus compradores).
export type DiscountCodeEstado = 'ACTIVO' | 'DESACTIVADO' | 'VENCIDO' | 'AGOTADO'

export interface EnvioDescuento {
  enviados: number
  total: number
  resultados: { email: string; enviado: boolean }[]
}

export interface DiscountLimits {
  amountBase: number
  minAmount: number
  maxPercentOff: number
}

export interface DiscountCodeRow {
  id: string
  code: string
  percentOff: number
  maxUses: number | null
  usedCount: number
  isActive: boolean
  expiresAt: string | null
  includesAdvancedAddon: boolean
  note: string | null
  createdBy: string | null
  createdAt: string
  estado: DiscountCodeEstado
}

export interface DiscountRedemptionRow {
  id: string
  email: string
  businessId: string | null
  businessName: string | null
  amountBase: number
  amountFinal: number
  createdAt: string
}

export interface DiscountCodeDetail extends DiscountCodeRow {
  redemptions: DiscountRedemptionRow[]
}

export interface CreateDiscountCodeInput {
  code: string
  percentOff: number
  maxUses?: number | null
  expiresAt?: string | null
  includesAdvancedAddon?: boolean
  note?: string | null
}

export interface UpdateDiscountCodeInput {
  percentOff?: number
  maxUses?: number | null
  isActive?: boolean
  expiresAt?: string | null
  includesAdvancedAddon?: boolean
  note?: string | null
}

export type BusinessStatus = 'draft' | 'active' | 'paused'

export interface Overview {
  businesses: {
    total: number
    active: number
    paused: number
    draft: number
    newLast30Days: number
    byMode: Record<string, number>
    byIndustry: { industry: string; count: number }[]
  }
  subscriptions: {
    byStatus: Record<string, number>
    byOrigin: Record<string, number>
    mrr: number
    currency: string
  }
  domains: {
    subdomainsInUse: number
    customBySource: Record<string, number>
    expiringSoon: number
  }
  generatedAt: string
}

export interface BusinessRow {
  id: string
  name: string
  subdomain: string
  industry: string
  mode: string
  status: BusinessStatus
  createdAt: string
  owner: { name: string; email: string; lastAccessAt: string | null } | null
  subscription: { status: string; plan: string; origin: string; amount: number; currentPeriodEnd: string } | null
  customDomain: string | null
  counts: { products: number; orders: number; customers: number }
}

export interface BusinessList {
  data: BusinessRow[]
  total: number
  page: number
  limit: number
}

export interface BusinessDetail {
  id: string
  name: string
  industry: string
  subrubros: string[]
  description: string | null
  subdomain: string
  mode: string
  status: BusinessStatus
  createdAt: string
  team: { id: string; name: string; email: string; role: string; status: string; lastAccessAt: string | null; emailVerified: boolean }[]
  branches: { id: string; name: string; isDefault: boolean }[]
  subscription: {
    status: string
    plan: string
    origin: string
    amount: number
    currency: string
    currentPeriodStart: string
    currentPeriodEnd: string
    grantReason: string | null
    grantedBy: { name: string; email: string } | null
    payments: { id: string; amount: number; status: string; periodStart: string; periodEnd: string; paidAt: string | null; failedReason: string | null }[]
  } | null
  customDomains: { domain: string; source: string; status: string; sslStatus: string; dnsVerified: boolean; expiresAt: string | null; autoRenew: boolean }[]
  metrics: {
    products: number
    customers: number
    orders: number
    salesAllTime: number
    ordersLast30Days: number
    salesLast30Days: number
  }
  activity: { action: string; details: unknown; admin: { name: string; email: string } | null; createdAt: string }[]
}

export interface DomainsList {
  subdomains: { subdomain: string; fullHost: string; businessId: string; businessName: string; mode: string; status: BusinessStatus }[]
  customDomains: {
    domain: string
    businessId: string
    businessName: string
    source: string
    status: string
    sslStatus: string
    dnsVerified: boolean
    purchasedAt: string | null
    expiresAt: string | null
    autoRenew: boolean
  }[]
}

export interface OwnerRow {
  id: string
  name: string
  email: string
  emailVerified: boolean
  lastAccessAt: string | null
  business: { id: string; name: string; subdomain: string; status: BusinessStatus } | null
}

export type PlatformAdminRole = 'SUPERADMIN' | 'OPERATOR'

export interface AdminRow {
  id: string
  name: string
  email: string
  role: PlatformAdminRole
  jobTitle: string | null
  isActive: boolean
  hasPassword: boolean
  hasGoogle: boolean
  lastAccessAt: string | null
  createdAt: string
}

export interface UpsertAdminInput {
  name: string
  email: string
  role: PlatformAdminRole
  jobTitle?: string
}

export interface LogRow {
  id: string
  admin: { id: string; name: string; email: string }
  action: string
  targetType: string
  targetId: string
  businessName: string | null
  details: unknown
  createdAt: string
}

export interface LogsList {
  data: LogRow[]
  total: number
  page: number
  limit: number
}

export interface GrantCompInput {
  currentPeriodEnd: string
  grantReason: string
}

export interface SubscriptionRow {
  businessId: string
  status: string
  origin: string
  plan: string
  amount: number
  currency: string
  currentPeriodStart: string
  currentPeriodEnd: string
  grantReason: string | null
}

export interface SubscriptionListRow {
  businessId: string
  business: { id: string; name: string; subdomain: string } | null
  status: string
  origin: string
  plan: string
  amount: number
  currency: string
  currentPeriodEnd: string
  grantReason: string | null
}

export type SeriesRange = 7 | 30 | 90 | 180

export interface GrowthPoint { date: string; businesses: number; subscriptions: number }
export interface RevenuePoint { date: string; amount: number }
export interface BusinessSeriesPoint { date: string; orders: number; sales: number; newCustomers: number }

export interface BusinessProductRow {
  id: string
  name: string
  categoryName: string | null
  status: string
  basePrice: number
  totalStock: number
}

export interface BusinessReviewRow {
  id: string
  productName: string
  customerName: string
  text: string
  status: string
  isVerified: boolean
  createdAt: string
}

export interface MailTemplateRow {
  id: string
  label: string
  group: 'Cuenta' | 'Equipo' | 'Pedidos' | 'Plataforma'
  subject: string
}

export interface MailTemplatePreview {
  subject: string
  html: string
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

// ─── Analítica del wizard de onboarding ──────────────────────────────────────
// El tramo anónimo del alta: gente que todavía no tiene cuenta (ver
// apps/api/src/wizard-analytics).

export interface WizardFunnelStep {
  step: number
  stepName: string
  sessions: number
  pctDelTotal: number
  perdidos: number
  pctCaida: number
  peorPaso: boolean
}

export interface WizardFunnel {
  pasos: WizardFunnelStep[]
  sesiones: number
  completaron: number
  pctConversion: number
}

export interface WizardFieldFriction {
  field: string
  stepName: string
  sesiones: number
  medianaSegundos: number
  sesionesConError: number
  sesionesAbandonadas: number
  reintentosPromedio: number
  indiceFriccion: number
  desglose: { errores: number; lentitud: number; abandono: number; reintentos: number }
}

export interface WizardFriction {
  campos: WizardFieldFriction[]
  /** Campos con datos pero con menos personas que `muestraMinima`. */
  insuficientes: number
  muestraMinima: number
}

export interface WizardAiOverview {
  turnos: number
  sesionesConOrbi: number
  pctAdopcion: number
  turnosPorSesion: number
  latenciaP50Ms: number
  latenciaP95Ms: number
  pulgarArriba: number
  pulgarAbajo: number
  aperturas: number
  sugerenciasAplicadas: number
  sugerenciasPisadas: number
  pctSugerenciasQueSobrevivieron: number
  conversionConOrbi: number
  conversionSinOrbi: number
}

export interface WizardAiTopics {
  temas: { topic: string; turnos: number; pctBienRespondidas: number }[]
  sinClasificar: number
}

export interface WizardAiQuestion {
  id: string
  question: string
  answer: string
  stepName: string | null
  rubro: string | null
  topic: string | null
  answeredWell: boolean | null
  rating: number | null
  latencyMs: number | null
  createdAt: string
}


// ─── Auditoría interna (super admin → Auditoría) ────────────────────────────
// Inventario vivo de lo que hay que revisar de Órbita, con responsable, estado,
// informe y verificaciones por ítem. Ver PlatformAuditItem en el backend.
export type AuditArea = 'BACKEND' | 'FRONTEND' | 'TRANSVERSAL' | 'HALLAZGO'
export type AuditEstado = 'PENDIENTE' | 'EN_CURSO' | 'HECHO'
export type AuditSeveridad = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA' | 'INFO'

export interface AuditCheck { id: string; texto: string; hecho: boolean }
export interface AuditAdminRef { id: string; name: string }

export interface AuditItemRow {
  id: string
  key: string
  area: AuditArea
  grupo: string
  titulo: string
  ruta: string | null
  foco: string
  severidad: AuditSeveridad | null
  estado: AuditEstado
  checks: AuditCheck[]
  checksHechos: number
  orden: number
  esPersonalizado: boolean
  responsable: AuditAdminRef | null
  informeUrl: string | null
  notas: string | null
  // Markdown: cómo está hecho el módulo, qué se verificó, qué se encontró.
  informe: string | null
  hechoPor: AuditAdminRef | null
  hechoAt: string | null
  actualizadoPor: AuditAdminRef | null
  // Qué se hace con el ítem: lo propone quien revisa y lo lee Ale antes de dar
  // la orden final. null = todavía nadie opinó. Ver TabDecisiones.
  decision: AuditDecision | null
  decisionNota: string | null
  decisionPor: AuditAdminRef | null
  decisionAt: string | null
  updatedAt: string
}

export interface AuditResumen {
  total: number
  hechos: number
  enCurso: number
  pendientes: number
  sinResponsable: number
  hallazgosAbiertos: number
  porArea: Record<string, { total: number; hechos: number; enCurso: number }>
}

export interface AuditListado {
  items: AuditItemRow[]
  resumen: AuditResumen
  admins: AuditAdminRef[]
}

export type AuditDecision = 'HACER' | 'NO_HACER' | 'HABLAR'

export interface UpdateAuditItemInput {
  estado?: AuditEstado
  responsableId?: string | null
  informeUrl?: string | null
  notas?: string | null
  informe?: string | null
  checks?: { id: string; hecho: boolean }[]
  nuevosChecks?: string[]
  // null vuelve el ítem a "sin decidir" y borra la nota.
  decision?: AuditDecision | null
  decisionNota?: string | null
}

export interface CreateAuditItemInput {
  area: AuditArea
  grupo: string
  titulo: string
  ruta?: string | null
  foco: string
  severidad?: AuditSeveridad | null
  checks: string[]
}

// ─── Soporte (super admin → Soporte) ────────────────────────────────────────
// Las consultas que un negocio manda desde Configuración → Soporte de su
// panel, con el hilo de idas y vueltas con el equipo de Órbita. Mismos nombres
// que el DTO del backend (support module) y que el cliente del panel
// (lib/api.ts): si cambia uno, cambian los tres.
export type SupportCategory = 'DOMINIO' | 'FACTURACION' | 'TECNICO' | 'CUENTA' | 'OTRO'
export type SupportRequestStatus = 'OPEN' | 'ANSWERED' | 'CLOSED'
export type SupportMessageAuthor = 'MEMBER' | 'ADMIN'

export interface SupportAttachment {
  url: string
  name: string
  size?: number
  type?: string
}

export interface SupportMessageDto {
  id: string
  author: SupportMessageAuthor
  authorName: string
  authorTitle: string | null
  body: string
  attachments: SupportAttachment[]
  createdAt: string
}

export interface AdminSupportRow {
  id: string
  // Correlativo global ("Consulta #12"): es lo que el negocio ve en el mail y
  // lo que va a nombrar cuando escriba de nuevo.
  number: number
  category: SupportCategory
  subject: string
  status: SupportRequestStatus
  createdAt: string
  lastMessageAt: string
  messagesCount: number
  // PANEL: Configuración → Soporte con sesión. LANDING: formulario público de
  // orbita.site, sin sesión.
  source: 'PANEL' | 'LANDING'
  // Si el email de quien escribe tiene cuenta de miembro en algún negocio.
  // Es el filtro "Con cuenta / Sin cuenta".
  hasAccount: boolean
  // Null en LANDING sin cuenta. En LANDING con cuenta es el negocio del
  // miembro con ese email: la consulta se le colgó a él y la ve en su panel.
  business: { id: string; name: string; subdomain: string } | null
  // Quién escribió, venga de donde venga. memberId null solo sin cuenta.
  contact: { name: string; email: string; memberId: string | null }
  lastMessage: { author: SupportMessageAuthor; excerpt: string; createdAt: string } | null
}

export interface AdminSupportDetail extends AdminSupportRow {
  contactPhone: string | null
  messages: SupportMessageDto[]
}

export interface SupportList {
  data: AdminSupportRow[]
  total: number
  page: number
  limit: number
  openCount: number
}

export interface SupportManualChapter {
  chapterId: string
  helpful: number
  notHelpful: number
  comments: { businessName: string; comment: string; helpful: boolean; createdAt: string }[]
}

export interface SupportSummary {
  open: number
  answered: number
  closed: number
  // Qué opinan los negocios de cada capítulo del manual (pulgar arriba/abajo
  // con comentario opcional). Se muestra al pie de Soporte porque es la otra
  // mitad de "en qué se traban": lo que preguntan y lo que no entendieron.
  manual: SupportManualChapter[]
}

// ─── Control de costos (super admin → Costos) ─────────────────────────────
export interface CostProviderSummary {
  slug: string
  name: string
  color: string
  amountUsd: number
  previousAmountUsd: number
  deltaPercent: number
  sparkline: number[]
}

export interface CostOverviewResponse {
  month: string
  totalUsd: number
  previousTotalUsd: number
  deltaPercent: number
  providers: CostProviderSummary[]
}

export interface CostHistoryMonth {
  month: string
  totalUsd: number
  byProvider: Record<string, number>
}

export interface CostHistoryResponse {
  months: CostHistoryMonth[]
}

export interface CostProviderDetail {
  slug: string
  name: string
  color: string
  month: string
  amountUsd: number
  breakdown: Record<string, number>
  source: string
}

export interface CostBusinessRow {
  businessId: string
  businessName: string
  totalEstimatedUsd: number
  byCategory: Record<string, number>
  pctOfTotal: number
}

export interface CostByBusinessResponse {
  month: string
  businesses: CostBusinessRow[]
}

export interface CostLimitRow {
  id: string
  provider: { slug: string; name: string; color: string } | null
  type: 'SPEND' | 'USAGE'
  category: string | null
  threshold: number
  unit: string
  alertAtPercent: number[]
  currentValue: number
  percent: number
  active: boolean
}

export interface CreateCostLimitInput {
  providerSlug?: string | null
  type: 'SPEND' | 'USAGE'
  category?: string | null
  threshold: number
  unit: string
  alertAtPercent: number[]
}

export interface CostAlertRow {
  id: string
  limit: { id: string; provider: { name: string; color: string } | null; type: string; threshold: number; unit: string }
  percentReached: number
  currentValue: number
  notifiedAt: string
  acknowledgedAt: string | null
}

// Arma "?a=1&b=2" salteando lo vacío, para no mandar `status=` cuando el
// filtro está en "Todas".
function toQuery(params: Record<string, string | number | undefined | null>): string {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v))
  })
  const q = qs.toString()
  return q ? `?${q}` : ''
}

export const platformApi = {
  overview: () => getJSON<Overview>('/platform/overview'),
  businesses: (params: { search?: string; status?: string; mode?: string; subscription?: string; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v))
    })
    const q = qs.toString()
    return getJSON<BusinessList>(`/platform/businesses${q ? `?${q}` : ''}`)
  },
  business: (id: string) => getJSON<BusinessDetail>(`/platform/businesses/${id}`),
  suspendBusiness: (id: string, reason?: string) => sendJSON<{ ok: true }>(`/platform/businesses/${id}/suspend`, 'POST', { reason }),
  reactivateBusiness: (id: string) => sendJSON<{ ok: true }>(`/platform/businesses/${id}/reactivate`, 'POST'),
  grantComp: (businessId: string, input: GrantCompInput) => sendJSON<SubscriptionRow>(`/platform/subscriptions/${businessId}/grant-comp`, 'POST', input),
  domains: () => getJSON<DomainsList>('/platform/domains'),
  owners: () => getJSON<OwnerRow[]>('/platform/owners'),
  subscriptions: () => getJSON<SubscriptionListRow[]>('/platform/subscriptions'),

  growthSeries: (days?: SeriesRange) => getJSON<{ series: GrowthPoint[] }>(`/platform/growth-series${days ? `?days=${days}` : ''}`),
  revenueSeries: (days?: SeriesRange) => getJSON<{ series: RevenuePoint[] }>(`/platform/revenue-series${days ? `?days=${days}` : ''}`),
  businessSeries: (id: string, days?: SeriesRange) => getJSON<{ series: BusinessSeriesPoint[] }>(`/platform/businesses/${id}/series${days ? `?days=${days}` : ''}`),
  businessProducts: (id: string) => getJSON<{ data: BusinessProductRow[] }>(`/platform/businesses/${id}/products`),
  businessReviews: (id: string) => getJSON<{ data: BusinessReviewRow[] }>(`/platform/businesses/${id}/reviews`),

  wizardFunnel: (days?: SeriesRange) => getJSON<WizardFunnel>(`/platform/wizard/funnel${days ? `?days=${days}` : ''}`),
  wizardFriction: (days?: SeriesRange) => getJSON<WizardFriction>(`/platform/wizard/friction${days ? `?days=${days}` : ''}`),
  wizardAi: (days?: SeriesRange) => getJSON<WizardAiOverview>(`/platform/wizard/ai${days ? `?days=${days}` : ''}`),
  wizardAiTopics: (days?: SeriesRange) => getJSON<WizardAiTopics>(`/platform/wizard/ai-topics${days ? `?days=${days}` : ''}`),
  wizardAiQuestions: (days?: SeriesRange) => getJSON<WizardAiQuestion[]>(`/platform/wizard/ai-questions${days ? `?days=${days}` : ''}`),

  audit: () => getJSON<AuditListado>('/platform/audit'),
  createAuditItem: (input: CreateAuditItemInput) => sendJSON<AuditItemRow>('/platform/audit/items', 'POST', input),
  updateAuditItem: (id: string, input: UpdateAuditItemInput) => sendJSON<AuditItemRow>(`/platform/audit/items/${id}`, 'PUT', input),
  removeAuditItem: (id: string) => sendJSON<{ ok: true }>(`/platform/audit/items/${id}`, 'DELETE'),

  admins: () => getJSON<AdminRow[]>('/platform/admins'),
  createAdmin: (input: UpsertAdminInput) => sendJSON<{ id: string }>('/platform/admins', 'POST', input),
  updateAdmin: (id: string, input: UpsertAdminInput) => sendJSON<{ id: string }>(`/platform/admins/${id}`, 'PUT', input),
  removeAdmin: (id: string) => sendJSON<{ ok: true }>(`/platform/admins/${id}`, 'DELETE'),

  logs: (params: { adminId?: string; action?: string; businessId?: string; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) qs.set(k, String(v))
    })
    const q = qs.toString()
    return getJSON<LogsList>(`/platform/logs${q ? `?${q}` : ''}`)
  },

  mailTemplates: () => getJSON<MailTemplateRow[]>('/platform/mail-templates'),
  mailPreview: (id: string) => getJSON<MailTemplatePreview>(`/platform/mail-templates/${id}/preview`),
  sendMailTest: (id: string, to: string) => sendJSON<{ sent: boolean }>(`/platform/mail-templates/${id}/send-test`, 'POST', { to }),

  discountCodes: () => getJSON<DiscountCodeRow[]>('/platform/discount-codes'),
  // Hasta qué porcentaje se puede descontar sin que el cobro caiga por debajo
  // del mínimo de Mercado Pago (el 100% queda afuera del límite: no pasa por MP).
  discountLimits: () => getJSON<DiscountLimits>('/platform/discount-codes/limits'),
  sendDiscountOffer: (id: string, input: { emails: string[]; saludo?: string }) =>
    sendJSON<EnvioDescuento>(`/platform/discount-codes/${id}/send`, 'POST', input),
  discountCode: (id: string) => getJSON<DiscountCodeDetail>(`/platform/discount-codes/${id}`),
  createDiscountCode: (input: CreateDiscountCodeInput) => sendJSON<DiscountCodeDetail>('/platform/discount-codes', 'POST', input),
  updateDiscountCode: (id: string, input: UpdateDiscountCodeInput) => sendJSON<DiscountCodeDetail>(`/platform/discount-codes/${id}`, 'PUT', input),

  // El backend devuelve las OPEN primero y después por última actividad: lo
  // que espera respuesta nunca queda enterrado bajo lo ya contestado.
  supportRequests: (params: { status?: string; category?: string; businessId?: string; account?: 'with' | 'without'; q?: string; page?: number; limit?: number } = {}) =>
    getJSON<SupportList>(`/platform/support${toQuery(params)}`),
  supportSummary: () => getJSON<SupportSummary>('/platform/support/summary'),
  supportRequest: (id: string) => getJSON<AdminSupportDetail>(`/platform/support/${id}`),
  // Responder deja la consulta en ANSWERED y le manda el mail al negocio; no
  // hay forma de contestar "en silencio" y está bien que así sea.
  supportReply: (id: string, message: string) => sendJSON<AdminSupportDetail>(`/platform/support/${id}/reply`, 'POST', { message }),
  supportStatus: (id: string, status: 'OPEN' | 'CLOSED') => sendJSON<AdminSupportDetail>(`/platform/support/${id}/status`, 'PUT', { status }),

  costsOverview: (months = 3) => getJSON<CostOverviewResponse>(`/platform/costs/overview?months=${months}`),
  costsHistory: (months = 6) => getJSON<CostHistoryResponse>(`/platform/costs/history?months=${months}`),
  costsProvider: (slug: string, month?: string) => getJSON<CostProviderDetail>(`/platform/costs/provider/${slug}${month ? `?month=${month}` : ''}`),
  costsByBusiness: (month?: string) => getJSON<CostByBusinessResponse>(`/platform/costs/by-business${month ? `?month=${month}` : ''}`),
  costsLimits: () => getJSON<CostLimitRow[]>('/platform/costs/limits'),
  costsCreateLimit: (body: CreateCostLimitInput) => sendJSON<CostLimitRow>('/platform/costs/limits', 'POST', body),
  costsDeleteLimit: (id: string) => sendJSON<{ ok: true }>(`/platform/costs/limits/${id}`, 'DELETE'),
  costsAlerts: (month?: string) => getJSON<CostAlertRow[]>(`/platform/costs/alerts${month ? `?month=${month}` : ''}`),
  costsAckAlert: (id: string) => sendJSON<{ ok: true }>(`/platform/costs/alerts/${id}/ack`, 'POST'),
  costsSync: () => sendJSON<{ synced: string[] }>('/platform/costs/sync', 'POST'),
  costsManualSnapshot: (body: { providerSlug: string; month: string; amountUsd: number; breakdown?: Record<string, number> }) =>
    sendJSON<{ id: string }>('/platform/costs/snapshot', 'POST', body),
}
