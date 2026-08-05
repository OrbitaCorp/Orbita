import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

// (Fase 2 — Alex) Los filtros que acepta la lista de pedidos del panel:
// estado, canal, búsqueda por cliente (o número de pedido), rango de fechas,
// sucursal y paginado. Cualquier valor raro se rechaza solo.
export class FindOrdersQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'])
  status?: 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';

  @IsOptional() @IsIn(['POS', 'ONLINE']) channel?: 'POS' | 'ONLINE';

  // (Postventa) 'true' = solo pedidos a los que se les puede devolver algo:
  // entregados/completados y con unidades sin devolver. Lo usa el paso 1 del
  // wizard de devoluciones para no ofrecer pedidos que solo pueden fallar.
  @IsOptional() @IsIn(['true', 'false']) returnable?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsUUID() branch_id?: string;
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
