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
  // "with": quien escribió tiene cuenta de miembro en algún negocio (todas
  // las del panel y las de la landing cuyo email coincide). "without": llegó
  // por la landing y ese email no está en ningún negocio.
  @IsOptional() @IsIn(['with', 'without']) account?: 'with' | 'without';
  // Busca en el asunto, el nombre del negocio y quién escribió (ilike).
  @IsOptional() @Transform(recortar) @IsString() @MaxLength(120) q?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
