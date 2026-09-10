import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FindCustomersQueryDto {
  // Tope de la búsqueda (auditoría interna 10/09, ítem `api.customers`).
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
