import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

// (RBT-615) Filtros del listado de cupones — filas de `discounts` con code≠null.
//
// `status` NO es columna: activo/inactivo/programado/expirado/agotado se derivan
// de isActive + fechas + usos al leer. 'agotado' NO es filtrable en SQL (requiere
// comparar dos columnas: usesConsumed >= maxUsesTotal) — mismo criterio que
// descuentos, ver find-discounts-query.dto.ts.
export class FindCouponsQueryDto {
  @IsOptional() @IsIn(['activo', 'inactivo', 'programado', 'expirado']) status?: string;

  @IsOptional() @IsIn(['PERCENT_PRODUCT', 'AMOUNT_PRODUCT', 'PERCENT_TICKET', 'AMOUNT_TICKET']) type?: string;

  @IsOptional() @IsString() search?: string; // busca en name Y code
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
