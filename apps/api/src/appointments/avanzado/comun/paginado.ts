import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginacionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export function paginacion(q: PaginacionDto, porDefecto = 50): { page: number; limit: number; skip: number } {
  const page = q.page ?? 1;
  const limit = q.limit ?? porDefecto;
  return { page, limit, skip: (page - 1) * limit };
}
