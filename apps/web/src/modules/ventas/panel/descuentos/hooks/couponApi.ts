// Adaptador entre el contrato del backend (/coupons, en inglés) y el tipo `Cupon`
// del panel (en español). Diferencia clave: el backend usa `DiscountType`
// (PERCENT_/AMOUNT_ × PRODUCT/TICKET) mientras el front usa `TipoCupon`
// ('porcentaje' | 'monto_fijo') combinado con `alcance`.
import type {
  ApiCouponRow,
  ApiCouponDetail,
  ApiUpsertCouponInput,
  ApiCouponType,
  ApiCouponScope,
} from '@/lib/api'
import type { Cupon, TipoCupon, AlcanceDescuento } from '../types'

const ALCANCE_A_API: Record<AlcanceDescuento, ApiCouponScope> = {
  producto: 'PRODUCT',
  categoria: 'CATEGORY',
  ticket: 'TICKET',
}

const API_A_ALCANCE: Record<ApiCouponScope, AlcanceDescuento> = {
  PRODUCT: 'producto',
  CATEGORY: 'categoria',
  TICKET: 'ticket',
}

// (TipoCupon × alcance) → DiscountType
export function tipoCuponAApi(tipo: TipoCupon, alcance: AlcanceDescuento): ApiCouponType {
  const esTicket = alcance === 'ticket'
  if (tipo === 'porcentaje') return esTicket ? 'PERCENT_TICKET' : 'PERCENT_PRODUCT'
  return esTicket ? 'AMOUNT_TICKET' : 'AMOUNT_PRODUCT'
}

// DiscountType → TipoCupon (el alcance sale de `scope`, no del type).
function apiATipoCupon(type: ApiCouponType): TipoCupon {
  return type === 'PERCENT_PRODUCT' || type === 'PERCENT_TICKET' ? 'porcentaje' : 'monto_fijo'
}

// El filtro "Tipo" del listado usa TipoCuponLabelKey (los 4 combinados), que el
// backend acepta tal cual como DiscountType. Los tipos avanzados no existen para
// cupones, así que no hay un guard como en descuentos.
export function tipoCuponLabelKeyAApi(key: string): ApiCouponType | null {
  const validos: ApiCouponType[] = ['PERCENT_PRODUCT', 'AMOUNT_PRODUCT', 'PERCENT_TICKET', 'AMOUNT_TICKET']
  const map: Record<string, ApiCouponType> = {
    porcentaje_ticket: 'PERCENT_TICKET',
    monto_fijo_ticket: 'AMOUNT_TICKET',
    porcentaje_producto: 'PERCENT_PRODUCT',
    monto_fijo_producto: 'AMOUNT_PRODUCT',
  }
  const t = map[key]
  return t && validos.includes(t) ? t : null
}

// Fila del listado. `creadoPor`/`link_redirect`/`link_creado_at`/`nivelProducto`
// no vienen en la fila (solo en el detalle) — placeholders inertes que la tabla
// no lee. `link_creado_at` no existe en el schema: siempre null.
export function filaApiACupon(d: ApiCouponRow): Cupon {
  return {
    id: d.id,
    codigo: d.code,
    nombre: d.name,
    tipoDescuento: apiATipoCupon(d.type),
    valor: d.value,
    alcance: API_A_ALCANCE[d.scope],
    montoMinimo: null,
    usosMaxTotal: d.maxUsesTotal,
    usosMaxPorCliente: d.maxUsesPerCustomer,
    usosConsumidos: d.usesConsumed,
    fechaInicio: d.startDate,
    fechaExpiracion: d.endDate,
    activo: d.isActive,
    privado: d.isPrivate,
    estado: d.estado,
    alcanceResumen: d.alcanceResumen,
    link_activo: d.linkActive,
    link_redirect: null,
    link_creado_at: null,
    creadoPor: '',
    createdAt: d.createdAt,
    updatedAt: d.createdAt,
  }
}

export function detalleApiACupon(d: ApiCouponDetail): Cupon {
  return {
    id: d.id,
    codigo: d.code,
    nombre: d.name,
    tipoDescuento: apiATipoCupon(d.type),
    valor: d.value,
    alcance: API_A_ALCANCE[d.scope],
    productosIds: d.productIds,
    categoriasIds: d.categoryIds,
    nivelProducto: d.productLevel ?? undefined,
    montoMinimo: d.minAmount,
    usosMaxTotal: d.maxUsesTotal,
    usosMaxPorCliente: d.maxUsesPerCustomer,
    usosConsumidos: d.usesConsumed,
    fechaInicio: d.startDate,
    fechaExpiracion: d.endDate,
    activo: d.isActive,
    privado: d.isPrivate,
    estado: d.estado,
    alcanceResumen: d.alcanceResumen,
    link_activo: d.linkActive,
    link_redirect: d.linkRedirect,
    link_creado_at: null,
    creadoPor: d.createdBy,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }
}

// Shape que arma CuponesCrear.handleSubmit (alta y edición mandan el objeto
// completo — el backend reemplaza todo, no soporta PATCH parcial).
export interface CuponInput {
  codigo: string
  nombre: string
  tipoDescuento: TipoCupon
  valor: number
  alcance: AlcanceDescuento
  productosIds?: string[]
  categoriasIds?: string[]
  montoMinimo: number | null
  usosMaxTotal: number | null
  usosMaxPorCliente: number | null
  fechaInicio: string
  fechaExpiracion: string | null
  privado: boolean
  link_activo: boolean
  link_redirect: string | null
}

export function cuponInputAApi(input: CuponInput): ApiUpsertCouponInput {
  return {
    code: input.codigo,
    name: input.nombre,
    type: tipoCuponAApi(input.tipoDescuento, input.alcance),
    value: input.valor,
    scope: ALCANCE_A_API[input.alcance],
    // Sin selector de variante (el árbol solo deja producto padre).
    productLevel: input.alcance === 'producto' ? 'padre' : undefined,
    minAmount: input.montoMinimo ?? undefined,
    maxUsesTotal: input.usosMaxTotal ?? undefined,
    maxUsesPerCustomer: input.usosMaxPorCliente ?? undefined,
    isPrivate: input.privado,
    startDate: input.fechaInicio,
    endDate: input.fechaExpiracion ?? undefined,
    linkActive: input.link_activo,
    linkRedirect: input.link_redirect ?? undefined,
    productIds: input.alcance === 'producto' ? input.productosIds : undefined,
    categoryIds: input.alcance === 'categoria' ? input.categoriasIds : undefined,
  }
}
