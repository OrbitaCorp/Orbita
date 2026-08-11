import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsUUID, IsEmail, IsArray, IsIn, IsObject, ValidateNested, Min } from 'class-validator';
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
}
export class CreateOrderDto {
  @IsIn(['POS', 'ONLINE']) channel!: 'POS' | 'ONLINE';
  @IsOptional() @IsUUID() branch_id?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => OrderItemInput) items!: OrderItemInput[];
  @IsOptional() @IsString() discountCode?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OrderPaymentInput) payments?: OrderPaymentInput[];
  @IsOptional() @IsUUID() shippingAddressId?: string;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => OrderBuyerInput) buyer?: OrderBuyerInput;
  // No puede ser negativo: un envío negativo bajaba el total (hasta $0) y
  // dejaba pasar pedidos con total falso que igual descuentan stock.
  @IsOptional() @IsNumber() @Min(0) shippingCost?: number;
}
