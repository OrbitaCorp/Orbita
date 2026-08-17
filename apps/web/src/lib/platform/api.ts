// Cliente del super panel (plataforma). Usa authedFetch, que inyecta el access
// token en memoria y refresca solo ante un 401. Pega directo al backend (mismo
// esquema que el resto del panel); al vivir en el apex, currentSlug() es null,
// así que no se manda X-Business-Slug.

import { authedFetch } from '@/lib/auth/authClient'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

async function getJSON<T>(path: string): Promise<T> {
  const res = await authedFetch(`${API_BASE}${path}`, { method: 'GET' })
  if (!res.ok) throw new Error(`Platform API ${res.status}`)
  return (await res.json()) as T
}

async function sendJSON<T>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const res = await authedFetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error((data as { message?: string })?.message ?? `Platform API ${res.status}`)
  return data as T
}

// ─── Tipos (subconjunto de lo que el backend devuelve, lo que se renderiza) ──

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
}
