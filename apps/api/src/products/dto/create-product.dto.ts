import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsUUID, IsEmail, IsArray, IsIn, IsObject, ValidateNested, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

class ProductVariantInput {
  // Presente en PUT para reconciliar contra una variante existente del producto;
  // ausente (o no matcheado) → se crea como variante nueva.
  @IsOptional() @IsUUID() id?: string;
  @IsOptional() @IsString() sku?: string;
  @IsNumber() @Min(0.01, { message: 'El precio de la variante debe ser mayor a $0' }) price!: number;
  @IsOptional() @IsNumber() @Min(0.01, { message: 'El precio de comparación de la variante debe ser mayor a $0' }) comparePrice?: number;
  @IsArray() @IsString({ each: true }) optionValues!: string[];
  // En POST es el stock con el que nace la variante. En PUT, para una variante
  // que ya existe, es el stock al que debe QUEDAR: el service calcula el delta
  // y registra un movimiento de ajuste (ver products.service.ts).
  @IsOptional() @IsInt() @Min(0, { message: 'El stock inicial no puede ser negativo' }) initialStock?: number;
  @IsOptional() @IsInt() @Min(0, { message: 'El stock mínimo no puede ser negativo' }) stockMin?: number;
  // false = esta combinación no se ofrece (ej. "Azul" no viene en "XL"). La
  // fila se crea/conserva igual — nunca se borra por esto. Default true si se
  // omite, para no romper otros callers que todavía no manden el campo.
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class ProductOptionInput {
  @IsString() name!: string;
  @IsArray() @IsString({ each: true }) values!: string[];
  // A lo sumo una opción del producto puede ser la "visual" (la única con
  // fotos por valor, ej. Color) — el service rechaza si llega más de una en true.
  @IsOptional() @IsBoolean() isVisual?: boolean;
}
class ProductSpecInput {
  @IsString() @MaxLength(60) label!: string;
  @IsString() @MaxLength(300) value!: string;
}
export class CreateProductDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  // Obligatoria: sin categoría el producto no aparece agrupado en ningún
  // lado del catálogo del cliente. El frontend ya bloquea el paso 1 si no
  // hay ninguna categoría creada — esto es el resguardo del lado del server.
  @IsUUID(undefined, { message: 'Debés seleccionar una categoría' }) categoryId!: string;
  @IsNumber() @Min(0.01, { message: 'El precio debe ser mayor a $0' }) basePrice!: number;
  @IsOptional() @IsNumber() @Min(0.01, { message: 'El precio de comparación debe ser mayor a $0' }) comparePrice?: number;
  @IsOptional() @IsNumber() @Min(0, { message: 'El costo no puede ser negativo' }) cost?: number;
  @IsOptional() @IsIn(['PUBLISHED', 'DRAFT']) status?: 'PUBLISHED' | 'DRAFT';
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) tagIds?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProductOptionInput) options?: ProductOptionInput[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => ProductVariantInput) variants!: ProductVariantInput[];
  // Especificaciones técnicas opcionales — igual que el resto del DTO, el
  // wizard manda la lista completa cada vez (se pisa entera, no es un patch
  // parcial); ausente/vacía = el producto no tiene, el storefront no
  // muestra la tabla de "Características".
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProductSpecInput) specs?: ProductSpecInput[];
}
