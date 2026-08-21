import { IsString, IsOptional, IsNumber, IsBoolean, IsEmail, IsArray, IsIn, Min, Max } from 'class-validator';

// Lista cerrada (no texto libre) — mismo criterio que `carrier` en
// update-order-shipping.dto.ts: así el storefront puede pintar cada pill
// con su propio label/ícono sin adivinar variantes de texto.
export const PICKUP_PAYMENT_METHODS = ['CASH', 'DEBIT', 'CREDIT'] as const;

export class UpdateBusinessConfigDto {
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() scheduleText?: string;
  @IsOptional() @IsBoolean() acceptsMercadopago?: boolean;
  @IsOptional() @IsBoolean() acceptsCash?: boolean;
  @IsOptional() @IsBoolean() acceptsTransfer?: boolean;
  @IsOptional() @IsBoolean() acceptsPickup?: boolean;
  @IsOptional() @IsBoolean() acceptsCard?: boolean;
  @IsOptional() @IsString() transferAlias?: string;
  @IsOptional() @IsString() transferCbu?: string;
  @IsOptional() @IsString() transferHolder?: string;
  @IsOptional() @IsArray() @IsIn(PICKUP_PAYMENT_METHODS, { each: true }) pickupPaymentMethods?: string[];
  @IsOptional() @IsNumber() @Min(0, { message: 'El descuento no puede ser negativo' }) @Max(100, { message: 'El descuento no puede superar el 100%' }) cashDiscountPercent?: number;
  @IsOptional() @IsNumber() @Min(0) shippingBase?: number;
  @IsOptional() @IsNumber() @Min(0) freeShippingFrom?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) deliveryZones?: string[];
  @IsOptional() @IsString() shippingPolicy?: string;
  @IsOptional() @IsString() instagram?: string;
  @IsOptional() @IsString() tiktok?: string;
  @IsOptional() @IsString() facebook?: string;
}
