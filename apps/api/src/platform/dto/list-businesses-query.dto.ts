import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

// Filtros de la lista de negocios del super panel. Todo opcional; cualquier
// valor fuera de rango se rechaza solo (ValidationPipe global).
export class ListBusinessesQueryDto {
  @IsOptional() @IsString() search?: string;

  // Estado operativo del negocio (derivado de isActive/isPaused).
  @IsOptional() @IsIn(['draft', 'active', 'paused']) status?: 'draft' | 'active' | 'paused';

  @IsOptional() @IsIn(['FULL', 'SHOWCASE']) mode?: 'FULL' | 'SHOWCASE';

  // Estado de la suscripción del negocio.
  @IsOptional()
  @IsIn(['ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'NONE'])
  subscription?: 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED' | 'NONE';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
