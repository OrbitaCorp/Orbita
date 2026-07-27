import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsUUID, IsEmail, IsArray, IsIn, IsObject, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

class ProductVariantInput {
  // Presente en PUT para reconciliar contra una variante existente del producto;
  // ausente (o no matcheado) → se crea como variante nueva.
  @IsOptional() @IsUUID() id?: string;
  @IsOptional() @IsString() sku?: string;
  @IsNumber() price!: number;
  @IsOptional() @IsNumber() comparePrice?: number;
  @IsArray() @IsString({ each: true }) optionValues!: string[];
  // En POST es el stock con el que nace la variante. En PUT, para una variante
  // que ya existe, es el stock al que debe QUEDAR: el service calcula el delta
  // y registra un movimiento de ajuste (ver products.service.ts).
  @IsOptional() @IsInt() initialStock?: number;
  @IsOptional() @IsInt() stockMin?: number;
}
class ProductOptionInput {
  @IsString() name!: string;
  @IsArray() @IsString({ each: true }) values!: string[];
}
export class CreateProductDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsNumber() basePrice!: number;
  @IsOptional() @IsNumber() comparePrice?: number;
  @IsOptional() @IsNumber() cost?: number;
  @IsOptional() @IsIn(['PUBLISHED', 'DRAFT']) status?: 'PUBLISHED' | 'DRAFT';
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) tagIds?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProductOptionInput) options?: ProductOptionInput[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => ProductVariantInput) variants!: ProductVariantInput[];
}
