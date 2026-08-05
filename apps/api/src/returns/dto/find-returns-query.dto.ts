import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

// (Fase 3 — Ale) Filtros de la lista de devoluciones: estado y paginado.
export class FindReturnsQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'IN_PROCESS', 'APPROVED', 'REJECTED'])
  status?: 'PENDING' | 'IN_PROCESS' | 'APPROVED' | 'REJECTED';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
