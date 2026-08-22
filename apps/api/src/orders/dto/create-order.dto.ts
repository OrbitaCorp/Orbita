import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsUUID, IsEmail, IsArray, IsIn, IsObject, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemInput {
  @IsUUID() variantId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsNumber() editedPrice?: number;
  @IsOptional() @IsBoolean() isConcept?: boolean;
  @IsOptional() @IsString() notes?: string;
}
class OrderPaymentInput {
  @IsIn(['MERCADOPAGO', 'CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'TRANSFER', 'QR']) method!: string;
  @IsNumber() amount!: number;
  @IsOptional() @IsString() reference?: string;
}
// (Fase 2 — Alex) Datos del comprador para pedidos manuales/online sin cliente
// registrado: el pedido necesita saber a nombre de quién va y a qué email avisar.
class OrderBuyerInput {
  @IsString() name!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() dni?: string;
}
// Dirección tipeada a mano (invitados del checkout público, o un cliente que
// no quiere guardarla) — se guarda como snapshot en el pedido, nunca crea una
// fila de Address. Mismo shape que CheckoutShippingAddressInput
// (storefront/dto/checkout.dto.ts, mismo criterio de obligatoriedad ahí
// también) — se repite en vez de importar entre módulos, mismo criterio que
// el resto de los DTOs de este archivo.
class OrderShippingAddressInput {
  @IsString() street!: string;
  @IsOptional() @IsString() floor?: string;
  @IsOptional() @IsString() depto?: string;
  @IsOptional() @IsString() referencia?: string;
  @IsString() provincia!: string;
  @IsString() city!: string;
  @IsString() zip!: string;
}
export class CreateOrderDto {
  @IsIn(['POS', 'ONLINE']) channel!: 'POS' | 'ONLINE';
  @IsOptional() @IsUUID() branch_id?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => OrderItemInput) items!: OrderItemInput[];
  @IsOptional() @IsString() discountCode?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OrderPaymentInput) payments?: OrderPaymentInput[];
  // Opcionales los dos: el alta manual del panel no tiene este concepto
  // todavía — solo los manda el checkout del storefront (ver
  // StorefrontController.checkout()).
  @IsOptional() @IsIn(['DELIVERY', 'PICKUP']) shippingMethod?: 'DELIVERY' | 'PICKUP';
  @IsOptional() @IsUUID() shippingAddressId?: string;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => OrderShippingAddressInput) shippingAddress?: OrderShippingAddressInput;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => OrderBuyerInput) buyer?: OrderBuyerInput;
  // No puede ser negativo: un envío negativo bajaba el total (hasta $0) y
  // dejaba pasar pedidos con total falso que igual descuentan stock.
  @IsOptional() @IsNumber() @Min(0) shippingCost?: number;
  // Descuento por método de pago (ej: efectivo) — distinto de un cupón: no
  // referencia ningún Discount, se calcula sobre el subtotal directo. Hoy lo
  // usa el checkout del storefront con BusinessConfig.cashDiscountPercent.
  @IsOptional() @IsNumber() @Min(0) @Max(100) manualDiscountPercent?: number;
  // Notas de crédito del cliente a canjear en este pedido — solo las manda
  // el checkout del storefront (mismo criterio que shippingMethod arriba);
  // el alta manual del panel no tiene este concepto todavía. Requiere
  // `customerId`: una nota de crédito siempre pertenece a un Customer real.
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) creditNoteIds?: string[];
  // Transportista preferido por el cliente para coordinar el envío — solo lo
  // manda el checkout del storefront (mismo criterio que shippingMethod
  // arriba); el alta manual del panel no lo exige. Mismo enum que
  // UpdateOrderShippingDto.
  @IsOptional() @IsIn(['CORREO_ARGENTINO', 'OCA', 'ANDREANI', 'VIA_CARGO', 'DELIVERY_APP', 'OTRO']) carrier?: string;
  // A domicilio o en sucursal DEL TRANSPORTISTA elegido — mismo criterio que
  // `carrier`: opcional acá, solo lo manda el checkout del storefront.
  @IsOptional() @IsIn(['DOMICILIO', 'SUCURSAL']) carrierDeliveryMode?: string;
}
