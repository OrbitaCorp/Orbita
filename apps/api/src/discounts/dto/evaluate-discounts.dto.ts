import { IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// El ítem del carrito solo lleva variante + cantidad, a propósito:
//
// - Sin `unitPrice`: el precio NUNCA viaja en el request. El motor usa siempre
//   el precio de la base (ProductVariant.price) — ver evaluate() en
//   discounts.service.ts. Aceptar un precio del cliente permitiría inflar el
//   subtotal para disparar un descuento con monto mínimo, así que el campo se
//   eliminó en vez de ignorarlo (era un footgun: invitaba a mandarlo esperando
//   que se respetara).
//
// - `@Min(1)` en quantity: antes un 0 o negativo pasaba la validación.
export class CartItemInput {
  @IsUUID() variantId!: string;
  @IsInt() @Min(1) quantity!: number;
}

// Sin `channel`: se eliminó junto con el POS (era 'POS' | 'STOREFRONT' y el
// service nunca lo leyó). Quién evalúa se resuelve por la sesión en el
// controller (member del panel o customer del storefront), no por el body.
export class EvaluateDiscountsDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => CartItemInput) items!: CartItemInput[];
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsString() couponCode?: string;
}
