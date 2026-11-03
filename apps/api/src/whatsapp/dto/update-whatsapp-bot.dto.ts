import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class UpdateWhatsappBotDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsIn(['SELECCIONADOS', 'TODOS']) modo?: 'SELECCIONADOS' | 'TODOS';
  /** Indicaciones del dueño para Orbi (tono, promociones, políticas). null o vacío las borra. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(1000) instrucciones?: string | null;
  /** Cómo atiende Orbi: todo con IA, menú + IA, o solo menú (sin IA). */
  @IsOptional() @IsIn(['CONVERSACIONAL', 'MENU_Y_CONVERSACION', 'SOLO_MENU']) modalidad?: 'CONVERSACIONAL' | 'MENU_Y_CONVERSACION' | 'SOLO_MENU';
  @IsOptional() @IsIn(['LISTA', 'BOTONES']) menuEstilo?: 'LISTA' | 'BOTONES';
  /** Saludo antes del menú. null o vacío vuelve al de siempre. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(600) bienvenida?: string | null;
  /** Las opciones del menú, en orden. Se validan en el servicio (límites de WhatsApp, ids, respuestas propias). */
  @IsOptional() @IsArray() @ArrayMaxSize(10) menuOpciones?: unknown[];
  /** Orbi puede tomar pedidos (quedan pendientes, "coordinar por WhatsApp"). */
  @IsOptional() @IsBoolean() tomaPedidos?: boolean;
  /** Tope de unidades y de monto (en pesos) por pedido tomado por Orbi. */
  @IsOptional() @IsInt() @Min(1) @Max(1000) maxUnidades?: number;
  @IsOptional() @IsInt() @Min(1000) @Max(100_000_000) maxMonto?: number;
  /** Tope mensual propio en créditos, por debajo del cupo del plan. null lo quita. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(1_000_000) topeCreditos?: number | null;
}
