import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Mismo shape que CheckoutItemInput (checkout.dto.ts) — se repite en vez de
// reexportar porque son dos DTOs de request distintos y no vale la pena
// acoplarlos por un tipo de dos campos. Mismos topes que el checkout
// (auditoría interna 10/09, ítem api.storefront).
class ValidateCartItemInput {
  @IsUUID() variantId!: string;
  @IsInt() @Min(1) @Max(10_000) quantity!: number;
}

export class ValidateCartDto {
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ValidateCartItemInput) items!: ValidateCartItemInput[];
  // Código tipeado a mano por el cliente (opcional) — si viene, se evalúa
  // junto con los descuentos automáticos vigentes (mismo motor, "mejor gana")
  // para que el carrito muestre el precio YA con el cupón antes de confirmar
  // la compra, en vez de recién enterarse si sirve al crear el pedido.
  @IsOptional() @IsString() @MaxLength(64) couponCode?: string;
}
