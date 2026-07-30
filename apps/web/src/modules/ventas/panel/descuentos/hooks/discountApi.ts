// Adaptador entre el contrato del backend (apps/api/src/discounts, en inglés,
// solo los 4 tipos triviales de V1) y el tipo `Descuento` del panel (en
// español, con los 7 tipos históricos del selector). Todo lo que entra o sale
// de la API pasa por acá — los hooks no arman shapes de request/response a mano.
import type {
  ApiDiscountRow,
  ApiDiscountDetail,
  ApiUpsertDiscountInput,
  ApiDiscountType,
  ApiDiscountScope,
  ApiDiscountApplication,
} from '@/lib/api'
import type { Descuento, TipoDescuento, AlcanceDescuento, Aplicacion, CondicionDescuento } from '../types'

export type TipoDescuentoSoportado = 'porcentaje_producto' | 'monto_fijo_producto' | 'porcentaje_ticket' | 'monto_fijo_ticket'

const TIPO_A_API: Record<TipoDescuentoSoportado, ApiDiscountType> = {
  porcentaje_producto: 'PERCENT_PRODUCT',
  monto_fijo_producto: 'AMOUNT_PRODUCT',
  porcentaje_ticket: 'PERCENT_TICKET',
  monto_fijo_ticket: 'AMOUNT_TICKET',
}

const API_A_TIPO: Record<ApiDiscountType, TipoDescuentoSoportado> = {
  PERCENT_PRODUCT: 'porcentaje_producto',
  AMOUNT_PRODUCT: 'monto_fijo_producto',
  PERCENT_TICKET: 'porcentaje_ticket',
  AMOUNT_TICKET: 'monto_fijo_ticket',
}

const ALCANCE_A_API: Record<AlcanceDescuento, ApiDiscountScope> = {
  producto: 'PRODUCT',
  categoria: 'CATEGORY',
  ticket: 'TICKET',
}

const API_A_ALCANCE: Record<ApiDiscountScope, AlcanceDescuento> = {
  PRODUCT: 'producto',
  CATEGORY: 'categoria',
  TICKET: 'ticket',
}

const APLICACION_A_API: Record<Aplicacion, ApiDiscountApplication> = {
  automatico: 'AUTOMATIC',
  manual: 'MANUAL',
}

const API_A_APLICACION: Record<ApiDiscountApplication, Aplicacion> = {
  AUTOMATIC: 'automatico',
  MANUAL: 'manual',
}

// El filtro "Tipo" del listado todavía ofrece los 3 tipos avanzados (el
// selector de alta ya no los deja elegir, pero types/descuentos.ts sigue
// declarando los 7 para no romper el listado histórico/mocks de cupones).
// Ningún descuento real puede tener esos tipos — el backend los rechaza al
// crear — así que si el usuario filtra por uno de ellos, la respuesta
// correcta es "no hay resultados", sin pegarle a la API con un filtro que no
// existe del otro lado.
export function tipoFiltroEsSoportado(tipo: TipoDescuento | 'todos'): boolean {
  return tipo === 'todos' || tipo in TIPO_A_API
}

export function tipoAApi(tipo: TipoDescuento): ApiDiscountType | null {
  return tipo in TIPO_A_API ? TIPO_A_API[tipo as TipoDescuentoSoportado] : null
}

// Fila del listado — el backend no manda `priority`/`createdBy`/`updatedAt`
// en /discounts (serían N lookups extra que la tabla no necesita); se
// completan con un placeholder inerte porque DescuentosTabla no los lee. El
// detalle real (con esos campos) llega por `useDescuento` al editar/ver.
export function filaApiADescuento(d: ApiDiscountRow): Descuento {
  return {
    id: d.id,
    nombre: d.name,
    tipo: API_A_TIPO[d.type],
    valor: d.value,
    alcance: API_A_ALCANCE[d.scope],
    aplicacion: API_A_APLICACION[d.application],
    fechaInicio: d.startDate,
    fechaFin: d.endDate,
    limiteUsosTotal: d.maxUsesTotal,
    usosConsumidos: d.usesConsumed,
    activo: d.isActive,
    prioridad: 0,
    estado: d.estado,
    recurrente: d.recurrente,
    alcanceResumen: d.alcanceResumen,
    creadoPor: '',
    createdAt: d.createdAt,
    updatedAt: d.createdAt,
  }
}

export function detalleApiADescuento(d: ApiDiscountDetail): Descuento {
  const condicion: CondicionDescuento | undefined = d.minAmount != null ? { montoMinimo: d.minAmount } : undefined
  return {
    id: d.id,
    nombre: d.name,
    tipo: API_A_TIPO[d.type],
    valor: d.value,
    alcance: API_A_ALCANCE[d.scope],
    productosIds: d.productIds,
    categoriasIds: d.categoryIds,
    nivelProducto: d.productLevel ?? undefined,
    condicion,
    aplicacion: API_A_APLICACION[d.application],
    fechaInicio: d.startDate,
    fechaFin: d.endDate,
    diasVigencia: d.activeDays.length ? d.activeDays : null,
    horaInicio: d.startTime,
    horaFin: d.endTime,
    limiteUsosTotal: d.maxUsesTotal,
    usosConsumidos: d.usesConsumed,
    activo: d.isActive,
    prioridad: d.priority,
    estado: d.estado,
    recurrente: d.recurrente,
    alcanceResumen: d.alcanceResumen,
    creadoPor: d.createdBy,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }
}

// Shape que arma DescuentosCrear.tsx (alta y edición mandan el objeto
// completo — el backend no soporta PATCH parcial, `update` reemplaza todo).
export interface DescuentoInput {
  nombre: string
  tipo: TipoDescuento
  valor: number
  alcance: AlcanceDescuento
  productosIds?: string[]
  categoriasIds?: string[]
  condicion?: CondicionDescuento
  aplicacion: Aplicacion
  fechaInicio: string
  fechaFin: string | null
  diasVigencia?: number[] | null
  horaInicio?: string | null
  horaFin?: string | null
  limiteUsosTotal: number | null
}

export function descuentoInputAApi(input: DescuentoInput): ApiUpsertDiscountInput {
  const type = tipoAApi(input.tipo)
  if (!type) throw new Error(`Tipo de descuento "${input.tipo}" no soportado por el backend.`)

  return {
    name: input.nombre,
    type,
    value: input.valor,
    scope: ALCANCE_A_API[input.alcance],
    // Sin selector de variante en el árbol de productos (ProductoArbol solo
    // deja elegir producto padre) — "padre" es el único valor posible hoy.
    productLevel: input.alcance === 'producto' ? 'padre' : undefined,
    minAmount: input.condicion?.montoMinimo,
    application: APLICACION_A_API[input.aplicacion],
    startDate: input.fechaInicio,
    endDate: input.fechaFin ?? undefined,
    activeDays: input.diasVigencia ?? undefined,
    startTime: input.horaInicio ?? undefined,
    endTime: input.horaFin ?? undefined,
    maxUsesTotal: input.limiteUsosTotal ?? undefined,
    productIds: input.alcance === 'producto' ? input.productosIds : undefined,
    categoryIds: input.alcance === 'categoria' ? input.categoriasIds : undefined,
  }
}
