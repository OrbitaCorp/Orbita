import { IsBooleanString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FindStockQueryDto {
  @IsOptional() @IsUUID() branch_id?: string;
  // Tope de la búsqueda (auditoría interna 10/09, ítem `api.inventory`).
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsBooleanString() lowStock?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
