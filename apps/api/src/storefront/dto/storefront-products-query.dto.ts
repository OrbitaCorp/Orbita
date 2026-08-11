import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class StorefrontProductsQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() featured?: boolean;
  // "Ofertas" del header: solo productos con comparePrice activo y mayor al
  // precio actual (mismo criterio que ya usa el badge "Oferta" del frontend).
  @IsOptional() @Type(() => Boolean) @IsBoolean() onSale?: boolean;
  @IsOptional() @Type(() => Boolean) @IsBoolean() inStock?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxPrice?: number;
  // 'bestselling' = "Más vendidos" del header (unidades históricas vendidas).
  @IsOptional() @IsIn(['relevancia', 'precio-asc', 'precio-desc', 'bestselling']) sort?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
