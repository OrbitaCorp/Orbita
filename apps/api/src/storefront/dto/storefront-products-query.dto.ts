import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class StorefrontProductsQueryDto {
  @IsOptional() @IsString() search?: string;
  // Uno o varios ids separados por coma ("id1,id2") — filtro de categoría del
  // catálogo pasó a ser multi-select (antes solo un id). Se valida acá que
  // cada trozo sea un UUID real; el WHERE de a uno o de varios se arma en
  // listProducts() (ver storefront.service.ts).
  @IsOptional()
  @IsString()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(,[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})*$/i, {
    message: 'categoryId debe ser un UUID o una lista de UUIDs separados por coma',
  })
  categoryId?: string;
  // Uno o varios ids de ProductOptionValue separados por coma — filtro
  // genérico por variación (talle, color, o cualquier otra que el negocio
  // haya definido, ver ProductOption/ProductOptionValue en el schema). Mismo
  // formato CSV que categoryId; el agrupado por tipo de opción (para que
  // "M,L" dentro de Talle sea un OR pero Talle Y Color sean un AND entre sí)
  // se resuelve en listProducts() — acá solo se valida el formato.
  @IsOptional()
  @IsString()
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(,[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})*$/i, {
    message: 'optionValues debe ser un UUID o una lista de UUIDs separados por coma',
  })
  optionValues?: string;
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
