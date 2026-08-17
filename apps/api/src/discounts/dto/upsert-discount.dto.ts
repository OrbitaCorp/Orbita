import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsUUID, IsEmail, IsArray, IsIn, IsObject, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertDiscountDto {
  @IsString() name!: string;
  @IsOptional() @IsString() code?: string;
  @IsIn(['PERCENT_PRODUCT', 'AMOUNT_PRODUCT', 'PERCENT_TICKET', 'AMOUNT_TICKET']) type!: string;
  @IsNumber() value!: number;
  @IsIn(['PRODUCT', 'CATEGORY', 'TICKET']) scope!: string;
  @IsOptional() @IsIn(['padre', 'variante']) productLevel?: string;
  @IsOptional() @IsInt() minQuantity?: number;
  @IsOptional() @IsNumber() minAmount?: number;
  @IsOptional() @IsIn(['AUTOMATIC', 'MANUAL']) application?: string;
  @IsString() startDate!: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsArray() activeDays?: number[];
  @IsOptional() @IsString() startTime?: string;
  @IsOptional() @IsString() endTime?: string;
  @IsOptional() @IsInt() maxUsesTotal?: number;
  @IsOptional() @IsInt() maxUsesPerCustomer?: number;
  @IsOptional() @IsBoolean() isPrivate?: boolean;
  @IsOptional() @IsInt() priority?: number;
  // Link compartible (RBT-613-bis) — a diferencia del cupón, sin destino
  // configurable: un descuento ya define su propio alcance (producto/
  // categoría), el link siempre lleva a esos productos. Se identifica por
  // `id`, nunca por código — un descuento no tiene (ver DiscountsService,
  // `code` siempre null acá).
  @IsOptional() @IsBoolean() linkActive?: boolean;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) productIds?: string[];
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) categoryIds?: string[];
}
