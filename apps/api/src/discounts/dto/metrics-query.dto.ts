import { IsIn, IsOptional, IsString } from 'class-validator';

// (Métricas de descuentos/cupones) Filtros de la pantalla de Rendimiento.
export class MetricsQueryDto {
  @IsOptional() @IsIn(['hoy', '7d', '30d', '90d', '12m', 'personalizado']) rango?: string;
  @IsOptional() @IsString() fechaDesde?: string;
  @IsOptional() @IsString() fechaHasta?: string;
  // 'pos' queda como opción muerta (RedemptionChannel aún la tiene, pero ya no
  // se generan redenciones POS). Se acepta para no romper el filtro del front.
  @IsOptional() @IsIn(['todos', 'pos', 'storefront']) canal?: string;
  @IsOptional() @IsIn(['todos', 'descuentos', 'cupones']) tipo?: string;
}
