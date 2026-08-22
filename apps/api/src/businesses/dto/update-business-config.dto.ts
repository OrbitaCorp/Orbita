import { IsString, IsOptional, IsNumber, IsBoolean, IsEmail, IsArray, IsIn, IsObject, Min, Max } from 'class-validator';

// Lista cerrada (no texto libre) — mismo criterio que `carrier` en
// update-order-shipping.dto.ts: así el storefront puede pintar cada pill
// con su propio label/ícono sin adivinar variantes de texto.
export const PICKUP_PAYMENT_METHODS = ['CASH', 'DEBIT', 'CREDIT'] as const;

// Mismo enum cerrado que `carrier` en checkout.dto.ts/update-order-shipping.dto.ts.
export const CARRIERS = ['CORREO_ARGENTINO', 'OCA', 'ANDREANI', 'VIA_CARGO', 'DELIVERY_APP', 'OTRO'] as const;

export class UpdateBusinessConfigDto {
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() scheduleText?: string;
  @IsOptional() @IsBoolean() acceptsMercadopago?: boolean;
  @IsOptional() @IsBoolean() acceptsCash?: boolean;
  @IsOptional() @IsBoolean() acceptsTransfer?: boolean;
  @IsOptional() @IsBoolean() acceptsPickup?: boolean;
  @IsOptional() @IsBoolean() acceptsCard?: boolean;
  @IsOptional() @IsBoolean() acceptsCoordinateLater?: boolean;
  @IsOptional() @IsString() transferAlias?: string;
  @IsOptional() @IsString() transferCbu?: string;
  @IsOptional() @IsString() transferHolder?: string;
  @IsOptional() @IsArray() @IsIn(PICKUP_PAYMENT_METHODS, { each: true }) pickupPaymentMethods?: string[];
  @IsOptional() @IsNumber() @Min(0, { message: 'El descuento no puede ser negativo' }) @Max(100, { message: 'El descuento no puede superar el 100%' }) cashDiscountPercent?: number;
  @IsOptional() @IsNumber() @Min(0) shippingBase?: number;
  @IsOptional() @IsNumber() @Min(0) freeShippingFrom?: number;
  @IsOptional() @IsString() shippingPolicy?: string;
  @IsOptional() @IsArray() @IsIn(CARRIERS, { each: true }) enabledCarriers?: string[];
  // Costo de envío específico por transportista (pisa `shippingBase` para
  // ese transportista) — parcial, solo los que el negocio cargó. Claves y
  // valores se validan en businesses.service.ts (contra CARRIERS y >= 0):
  // un objeto con forma libre no se puede expresar bien con decoradores de
  // class-validator solos.
  @IsOptional() @IsObject() carrierShippingCosts?: Record<string, number>;
  @IsOptional() @IsBoolean() returnsEnabled?: boolean;
  @IsOptional() @IsBoolean() returnsCreditNoteEnabled?: boolean;
  @IsOptional() @IsBoolean() returnsMpRefundEnabled?: boolean;
  @IsOptional() @IsBoolean() cancellationsEnabled?: boolean;
  @IsOptional() @IsBoolean() cancellationsCreditNoteEnabled?: boolean;
  @IsOptional() @IsBoolean() cancellationsMpRefundEnabled?: boolean;
  @IsOptional() @IsString() instagram?: string;
  @IsOptional() @IsString() tiktok?: string;
  @IsOptional() @IsString() facebook?: string;
}
