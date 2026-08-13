import { IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';
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
}
