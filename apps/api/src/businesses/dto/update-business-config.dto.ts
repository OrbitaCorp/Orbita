import { IsString, IsOptional, IsNumber, IsBoolean, IsEmail, IsArray, IsIn, IsObject, Min, Max } from 'class-validator';

// Lista cerrada (no texto libre) — mismo criterio que `carrier` en
// update-order-shipping.dto.ts: así el storefront puede pintar cada pill
// con su propio label/ícono sin adivinar variantes de texto.
//
// Vacía = sin restricción, mismo criterio que `enabledCarriers`: cada medio
// vale según su toggle global (acceptsCash/acceptsMercadopago). Marcar acá
// adentro de "Medios que aceptás al retirar" es SOLO para restringir
// puntualmente qué de todo eso aplica al retiro — nunca hace falta tocarlo
// para que MP/efectivo sigan funcionando en retiro tal como ya funcionan en
// el resto del checkout. DEBIT/CREDIT son la única excepción: no tienen
// toggle global (posnet físico, solo existe en retiro), así que esos dos
// SIEMPRE necesitan estar marcados acá para aparecer — ver
// StorefrontController.checkout(). TRANSFER (Coordinar por WhatsApp) queda
// deliberadamente fuera de esta lista: a pedido, siempre sigue el toggle
// general (acceptsTransfer), nunca se restringe puntual para retiro.
export const PICKUP_PAYMENT_METHODS = ['CASH', 'DEBIT', 'CREDIT', 'MERCADOPAGO'] as const;

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
  // RBT-692 — mismo criterio que cashDiscountPercent, generalizado. transferDiscountPercent
  // cuelga de acceptsTransfer, que hoy es "Coordinar por WhatsApp" (no transferencia
  // bancaria) — ver comentario en el schema de BusinessConfig.
  @IsOptional() @IsNumber() @Min(0, { message: 'El descuento no puede ser negativo' }) @Max(100, { message: 'El descuento no puede superar el 100%' }) mercadopagoDiscountPercent?: number;
  @IsOptional() @IsNumber() @Min(0, { message: 'El descuento no puede ser negativo' }) @Max(100, { message: 'El descuento no puede superar el 100%' }) transferDiscountPercent?: number;
  // RBT-691 — lista cerrada (selector, no número libre): 21% general, 10.5%
  // reducido, 0% exento. Mismos 3 valores que castiga la normativa vigente.
  @IsOptional() @IsNumber() @IsIn([0, 10.5, 21], { message: 'La alícuota de IVA debe ser 0, 10.5 o 21' }) ivaRate?: number;
  // Pedido explícito del dueño (2026-09-06) — oculta la leyenda de IVA por
  // completo en checkout/detalle sin perder `ivaRate` (ver comentario en el
  // schema). Pisa la decisión original de RBT-691 de no permitir esto.
  @IsOptional() @IsBoolean() ivaDisabled?: boolean;
  @IsOptional() @IsNumber() @Min(0) freeShippingFrom?: number;
  @IsOptional() @IsString() shippingPolicy?: string;
  @IsOptional() @IsArray() @IsIn(CARRIERS, { each: true }) enabledCarriers?: string[];
  // Costo de envío por transportista — sin costo general de respaldo: un
  // transportista sin costo acá no calcula envío. Parcial, solo los que el
  // negocio cargó. Claves y valores se validan en businesses.service.ts
  // (contra CARRIERS y >= 0): un objeto con forma libre no se puede
  // expresar bien con decoradores de class-validator solos.
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
