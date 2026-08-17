import { IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Mismo shape que CheckoutItemInput (checkout.dto.ts) — se repite en vez de
// reexportar porque son dos DTOs de request distintos y no vale la pena
// acoplarlos por un tipo de dos campos.
class ValidateCartItemInput {
  @IsUUID() variantId!: string;
  @IsInt() @Min(1) quantity!: number;
}

export class ValidateCartDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ValidateCartItemInput) items!: ValidateCartItemInput[];
  // Código tipeado a mano por el cliente (opcional) — si viene, se evalúa
  // junto con los descuentos automáticos vigentes (mismo motor, "mejor gana")
  // para que el carrito muestre el precio YA con el cupón antes de confirmar
  // la compra, en vez de recién enterarse si sirve al crear el pedido.
  @IsOptional() @IsString() couponCode?: string;
}
