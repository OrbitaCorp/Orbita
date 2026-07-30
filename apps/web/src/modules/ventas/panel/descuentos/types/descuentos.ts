import type { OrdenDireccion } from './comunes'

// ─── Enums ────────────────────────────────────────────────────────────────────

export type TipoDescuento =
  | 'porcentaje_producto'
  | 'monto_fijo_producto'
  | 'porcentaje_ticket'
  | 'monto_fijo_ticket'
  | 'lleva_x_paga_y'
  | 'compra_x_obtiene_z'
  | 'volumen'

// 'agotado' = llegó a su límite de usos. Lo deriva el backend (mismo criterio
// que usa el motor para excluirlo). Se muestra como badge pero NO es filtrable
// desde el listado: filtrar por agotado requiere comparar dos columnas
// (usesConsumed >= maxUsesTotal) que Prisma no soporta en un where simple —
// ver DescuentosFiltros y apps/api/PENDIENTES.md.
export type EstadoDescuento = 'activo' | 'inactivo' | 'programado' | 'expirado' | 'agotado'
export type Aplicacion = 'automatico' | 'manual'
export type AlcanceDescuento = 'producto' | 'categoria' | 'ticket'
export type NivelProducto = 'padre' | 'variante'
export type BonusTipoBeneficio = 'gratis' | 'porcentaje' | 'monto_fijo'

// ─── Condición (tipos condicionales) ──────────────────────────────────────────

export interface EscalaVolumen {
  desde: number
  hasta: number | null // null = sin tope superior
  porcentaje: number
}

export interface CondicionDescuento {
  cantidadMinima?: number
  montoMinimo?: number
  llevaCantidad?: number // "Llevá X"
  pagaCantidad?: number // "Pagá Y"
  escalasVolumen?: EscalaVolumen[]
}

// ─── Entidad ──────────────────────────────────────────────────────────────────

export interface Descuento {
  id: string
  nombre: string
  tipo: TipoDescuento
  valor: number
  alcance: AlcanceDescuento
  productosIds?: string[]
  categoriasIds?: string[]
  nivelProducto?: NivelProducto
  condicion?: CondicionDescuento
  // Bonus — solo tipo "compra_x_obtiene_z"
  bonusProductosIds?: string[]
  bonusCategoriasIds?: string[]
  bonusAlcance?: Exclude<AlcanceDescuento, 'ticket'>
  bonusTipoBeneficio?: BonusTipoBeneficio
  bonusValor?: number
  // Aplicación y vigencia
  aplicacion: Aplicacion
  fechaInicio: string // ISO 8601
  fechaFin: string | null // null = sin vencimiento
  diasVigencia?: number[] | null // [0-6], null = todos
  horaInicio?: string | null // "HH:mm"
  horaFin?: string | null
  limiteUsosTotal: number | null // null = ilimitado
  usosConsumidos: number
  activo: boolean
  prioridad: number
  // Campos derivados por el backend para el listado
  estado: EstadoDescuento
  recurrente: boolean
  alcanceResumen: string // texto para la columna "Alcance"
  // Metadata
  creadoPor: string
  createdAt: string
  updatedAt: string
}

// ─── Filtros ──────────────────────────────────────────────────────────────────

export type OrdenColumnaDescuento = 'nombre' | 'vigencia' | 'usos' | 'estado'

export interface DescuentosFiltros {
  estado: EstadoDescuento | 'todos'
  tipo: TipoDescuento | 'todos'
  busqueda: string
  pagina: number
  porPagina: number
  ordenColumna: OrdenColumnaDescuento
  ordenDireccion: OrdenDireccion
}

// ─── Labels ───────────────────────────────────────────────────────────────────

export const TIPO_DESCUENTO_LABELS: Record<TipoDescuento, string> = {
  porcentaje_producto: '% Producto',
  monto_fijo_producto: '$ Fijo Producto',
  porcentaje_ticket: '% Ticket',
  monto_fijo_ticket: '$ Fijo Ticket',
  lleva_x_paga_y: 'Llevá X Pagá Y',
  compra_x_obtiene_z: 'Comprá X Obtené Z',
  volumen: 'Volumen',
}

export const ESTADO_DESCUENTO_LABELS: Record<EstadoDescuento, string> = {
  activo: 'Activo',
  inactivo: 'Inactivo',
  programado: 'Programado',
  expirado: 'Expirado',
  agotado: 'Agotado',
}

// Estados por los que SÍ se puede filtrar en el listado (los que el backend
// sabe traducir a SQL). 'agotado' queda afuera a propósito — ver el comentario
// del type EstadoDescuento.
export const ESTADOS_DESCUENTO_FILTRABLES: EstadoDescuento[] = ['activo', 'inactivo', 'programado', 'expirado']
