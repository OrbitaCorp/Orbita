// Cliente público del storefront — sin auth (rutas @Public() del backend),
// scopeado siempre por slug. Mismo API_BASE que lib/auth/authClient.ts.
//
// Los adaptadores (toTiendaConfig/toCategoria/toProducto) convierten la
// respuesta real del backend a los tipos locales de lib/storefront/types.ts,
// para no tener que reescribir los componentes que ya consumen esos tipos
// (ProductCard, StorefrontHeader/Footer, etc. — ya son prop-driven).

import type { Categoria, Cupon, Producto, TiendaConfig } from './types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'orbita.site'

export class StorefrontApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function storefrontRequest<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/storefront${path}`)
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
  imageStyle?: string; imagePosition?: string; bgPattern?: string; bgColor?: string
}
export type StorefrontHeaderLink = { id: string; label: string; on: boolean }
export type StorefrontStatsItem = { id: string; value: string; label: string }

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
  isFeatured: boolean
  inStock: boolean
  createdAt: string
}

export type StorefrontSort = 'relevancia' | 'precio-asc' | 'precio-desc' | 'bestselling'

export type StorefrontProductsFilters = {
  categoryId?: string
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
  if (filters.categoryId) qs.set('categoryId', filters.categoryId)
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
  }[]
  images: { url: string; position: number; isPrimary: boolean; optionValueId: string | null }[]
}

export function getStorefrontProduct(slug: string, id: string) {
  return storefrontRequest<StorefrontProductDetail>(`/${slug}/products/${id}`)
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

// ─── Cupones públicos ─────────────────────────────────────────────────────────

export type StorefrontCoupon = {
  code: string
  name: string
  type: string // DiscountType del backend (PERCENT_* / AMOUNT_*)
  value: number
  minAmount: number | null
  endDate: string | null // ISO
  categories: string[]
}

export function getStorefrontCoupons(slug: string) {
  return storefrontRequest<StorefrontCoupon[]>(`/${slug}/coupons`)
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

const NUEVO_DIAS = 14

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
  return { id: c.id, nombre: c.name, count: c.productCount, hue: hueFromId(c.id) }
}

// El backend no tiene un campo "descripción" para el cupón — se usa el `name`.
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
  }
}

export function toProducto(p: StorefrontProductItem | StorefrontProductDetail): Producto {
  const esNuevo = 'createdAt' in p && Date.now() - new Date(p.createdAt).getTime() < NUEVO_DIAS * 24 * 60 * 60 * 1000
  const enOferta = p.comparePrice !== null && p.comparePrice > p.price
  const imageUrl = 'imageUrl' in p ? p.imageUrl : (p.images[0]?.url ?? null)
  const inStock = 'inStock' in p ? p.inStock : p.variants.some(v => v.inStock)
  return {
    id: p.id,
    nombre: p.name,
    cat: p.categoryName ?? '',
    precio: p.price,
    precioAnt: enOferta ? p.comparePrice : null,
    badge: enOferta ? 'Oferta' : esNuevo ? 'Nuevo' : null,
    hue: hueFromId(p.id),
    stock: inStock,
    imgUrl: imageUrl,
  }
}
