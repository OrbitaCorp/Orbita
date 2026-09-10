import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CartItemInput } from './evaluate-discounts.dto';

export class ValidateCouponDto {
  @IsString() @MaxLength(64) code!: string;
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => CartItemInput) items!: CartItemInput[];
  // Solo lo respeta el panel: a un cliente se lo evalúa siempre con su propio
  // id, del token (ver DiscountsController.validate).
  @IsOptional() @IsUUID() customerId?: string;
}
