import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class StorefrontProductsQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  // Filtra a los productos alcanzados por ESE cupón (alcance producto o
  // categoría) — usado por la pantalla del link exclusivo
  // (/tienda/:slug/descuentos/:codigo) para mostrar solo lo que el link
  // promete, en vez del catálogo completo. Se ignora en cupones de alcance
  // "ticket" (no tienen productos puntuales). Mutuamente excluyente con
  // discountId (uno es cupón por código, el otro descuento por id).
  @IsOptional() @IsString() discountCode?: string;
  // Igual que discountCode pero para un DESCUENTO (no cupón) — identificado
  // por id, nunca por código (un descuento siempre tiene code: null). Usado
  // por /tienda/:slug/oferta/:id.
  @IsOptional() @IsUUID() discountId?: string;
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
