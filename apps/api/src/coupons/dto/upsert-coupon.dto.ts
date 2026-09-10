import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

// (RBT-615) Alta/edición de cupón. Comparte tabla `discounts` con los descuentos,
// pero un cupón SIEMPRE tiene `code` (a diferencia del descuento, que lo deja
// null). Solo los 4 tipos triviales de V1 — cupones no tiene tipos avanzados.
//
// Topes desde la auditoría interna del 10/09 (ítem api.coupons). El código va
// en la URL del link exclusivo y lo tipea el cliente: letras, números, guion y
// guion bajo (los 23 de producción ya cumplían). `linkRedirect` solo como ruta
// de la tienda: una URL completa convertía el link del cupón en una
// redirección a cualquier sitio con el dominio de la tienda.
export class UpsertCouponDto {
  @IsString() @MaxLength(40) @Matches(/^\s*[A-Za-z0-9_-]+\s*$/, { message: 'El código solo puede tener letras, números, guion y guion bajo' })
  code!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsIn(['PERCENT_PRODUCT', 'AMOUNT_PRODUCT', 'PERCENT_TICKET', 'AMOUNT_TICKET']) type!: string;
  @IsNumber() @Min(0) @Max(1_000_000_000) value!: number;
  @IsIn(['PRODUCT', 'CATEGORY', 'TICKET']) scope!: string;
  @IsOptional() @IsIn(['padre', 'variante']) productLevel?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1_000_000_000) minAmount?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10_000_000) maxUsesTotal?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10_000) maxUsesPerCustomer?: number;
  @IsOptional() @IsBoolean() isPrivate?: boolean;
  // "YYYY-MM-DD" = día completo de Argentina (ver discount-status.util#vigenciaDe).
  @IsDateString() startDate!: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsBoolean() linkActive?: boolean;
  @IsOptional() @IsString() @MaxLength(300) @Matches(/^\/(?!\/)[A-Za-z0-9/_?=&.-]*$/, { message: 'El destino del link tiene que ser una página de la tienda' })
  linkRedirect?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @IsUUID('4', { each: true }) productIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('4', { each: true }) categoryIds?: string[];
}
