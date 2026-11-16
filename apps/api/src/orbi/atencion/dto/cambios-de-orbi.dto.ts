import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

/** Lo que el dueño configura de Orbi en cualquier canal (WhatsApp le suma el menú: ver UpdateWhatsappBotDto). */
export class CambiosDeOrbiDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsIn(['SELECCIONADOS', 'TODOS']) modo?: 'SELECCIONADOS' | 'TODOS';
  /** Indicaciones del dueño para Orbi (tono, promociones, políticas). null o vacío las borra. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(1000) instrucciones?: string | null;
  /** Orbi puede tomar pedidos (quedan pendientes, a coordinar por el chat). */
  @IsOptional() @IsBoolean() tomaPedidos?: boolean;
  /** Tope de unidades y de monto (en pesos) por pedido tomado por Orbi. */
  @IsOptional() @IsInt() @Min(1) @Max(1000) maxUnidades?: number;
  @IsOptional() @IsInt() @Min(1000) @Max(100_000_000) maxMonto?: number;
  /** Tope mensual propio en créditos, por debajo del cupo del plan. null lo quita. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(1_000_000) topeCreditos?: number | null;
}
