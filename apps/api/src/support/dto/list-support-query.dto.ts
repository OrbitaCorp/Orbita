import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { recortar } from './recortar';
import { SUPPORT_CATEGORIES, type SupportCategory } from './send-support-request.dto';

export const SUPPORT_STATUSES = ['OPEN', 'ANSWERED', 'CLOSED'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

// Filtros de la lista de consultas del superadmin. Todo opcional; lo que
// venga fuera de rango lo rechaza el ValidationPipe global (mismo criterio
// que ListLogsQueryDto).
export class ListSupportQueryDto {
  @IsOptional() @IsIn(SUPPORT_STATUSES) status?: SupportStatus;
  @IsOptional() @IsIn(SUPPORT_CATEGORIES) category?: SupportCategory;
  @IsOptional() @IsString() @MaxLength(64) businessId?: string;
  // Busca en el asunto y en el nombre del negocio (ilike).
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(120) q?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
