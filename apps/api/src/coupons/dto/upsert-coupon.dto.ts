import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsUUID, IsArray, IsIn, Min } from 'class-validator';

// (RBT-615) Alta/edición de cupón. Comparte tabla `discounts` con los descuentos,
// pero un cupón SIEMPRE tiene `code` (a diferencia del descuento, que lo deja
// null). Solo los 4 tipos triviales de V1 — cupones no tiene tipos avanzados.
export class UpsertCouponDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsIn(['PERCENT_PRODUCT', 'AMOUNT_PRODUCT', 'PERCENT_TICKET', 'AMOUNT_TICKET']) type!: string;
  @IsNumber() value!: number;
  @IsIn(['PRODUCT', 'CATEGORY', 'TICKET']) scope!: string;
  @IsOptional() @IsIn(['padre', 'variante']) productLevel?: string;
  @IsOptional() @IsNumber() minAmount?: number;
  @IsOptional() @IsInt() @Min(1) maxUsesTotal?: number;
  @IsOptional() @IsInt() @Min(1) maxUsesPerCustomer?: number;
  @IsOptional() @IsBoolean() isPrivate?: boolean;
  @IsString() startDate!: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsBoolean() linkActive?: boolean;
  @IsOptional() @IsString() linkRedirect?: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) productIds?: string[];
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) categoryIds?: string[];
}
