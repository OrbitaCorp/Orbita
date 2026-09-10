import { IsDateString, IsIn, IsOptional } from 'class-validator';

// (Métricas de descuentos/cupones) Filtros de la pantalla de Rendimiento.
export class MetricsQueryDto {
  @IsOptional() @IsIn(['hoy', '7d', '30d', '90d', '12m', 'personalizado']) rango?: string;
  // Fechas de verdad: una inválida llegaba a Prisma como Invalid Date y salía
  // un 500 (auditoría interna 10/09, ítem api.discounts).
  @IsOptional() @IsDateString() fechaDesde?: string;
  @IsOptional() @IsDateString() fechaHasta?: string;
  // 'pos' queda como opción muerta (RedemptionChannel aún la tiene, pero ya no
  // se generan redenciones POS). Se acepta para no romper el filtro del front.
  @IsOptional() @IsIn(['todos', 'pos', 'storefront']) canal?: string;
  @IsOptional() @IsIn(['todos', 'descuentos', 'cupones']) tipo?: string;
}
