import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

// (RBT-614) Filtros del listado de descuentos del panel — tab "Descuentos",
// o sea filas con code=null; los cupones (code≠null) son RBT-615/616.
//
// `status` NO es una columna: activo/inactivo/programado/expirado se derivan de
// isActive + startDate/endDate al leer (mismo criterio que las métricas de
// Customers: se calculan, no se guardan, para que nunca queden desactualizados).
export class FindDiscountsQueryDto {
  @IsOptional()
  @IsIn(['activo', 'inactivo', 'programado', 'expirado'])
  status?: 'activo' | 'inactivo' | 'programado' | 'expirado';

  @IsOptional()
  @IsIn(['PERCENT_PRODUCT', 'AMOUNT_PRODUCT', 'PERCENT_TICKET', 'AMOUNT_TICKET'])
  type?: 'PERCENT_PRODUCT' | 'AMOUNT_PRODUCT' | 'PERCENT_TICKET' | 'AMOUNT_TICKET';

  // "Oferta relámpago" (paquete Avanzado, RBT-675): el tipo del listado del
  // panel que no es una columna sino "tiene la cuenta regresiva prendida"
  // (fila en countdown_configs). Llega como string porque viene por query.
  @IsOptional() @IsIn(['true']) countdown?: 'true';

  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
