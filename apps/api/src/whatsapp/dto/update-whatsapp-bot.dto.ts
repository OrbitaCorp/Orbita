import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class UpdateWhatsappBotDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsIn(['SELECCIONADOS', 'TODOS']) modo?: 'SELECCIONADOS' | 'TODOS';
  /** Indicaciones del dueño para Orbi (tono, promociones, políticas). null o vacío las borra. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(1000) instrucciones?: string | null;
  /** Tope mensual propio en créditos, por debajo del cupo del plan. null lo quita. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(1_000_000) topeCreditos?: number | null;
}
