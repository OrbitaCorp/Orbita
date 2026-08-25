import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

// (Fase 3 — Ale) Filtros de la lista de notas de crédito.
export class FindCreditNotesQueryDto {
  @IsOptional()
  @IsIn(['ISSUED', 'APPLIED', 'CANCELLED'])
  status?: 'ISSUED' | 'APPLIED' | 'CANCELLED';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
