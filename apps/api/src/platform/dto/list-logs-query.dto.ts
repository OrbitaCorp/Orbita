import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

// Filtros de la lista de logs de auditoría del super panel (RBT-655). Todo
// opcional; cualquier valor fuera de rango se rechaza solo (ValidationPipe global).
export class ListLogsQueryDto {
  @IsOptional() @IsString() adminId?: string;
  @IsOptional() @IsString() action?: string;
  // `targetId` de PlatformAdminLog: coincide con businessId tanto para acciones
  // sobre el negocio (targetType 'business') como sobre su suscripción
  // (targetType 'subscription', ver grantComp) — no hace falta filtrar por
  // targetType además, `targetId` alcanza para "todo lo que le pasó a este negocio".
  @IsOptional() @IsString() businessId?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
