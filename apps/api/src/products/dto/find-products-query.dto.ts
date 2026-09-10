import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FindProductsQueryDto {
  // Tope de la búsqueda (auditoría interna 10/09, ítem `api.products`).
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsIn(['PUBLISHED', 'DRAFT', 'OUT_OF_STOCK']) status?: 'PUBLISHED' | 'DRAFT' | 'OUT_OF_STOCK';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
