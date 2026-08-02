import { IsString, IsOptional, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CartItemInput } from './evaluate-discounts.dto';

export class ValidateCouponDto {
  @IsString() code!: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CartItemInput) items!: CartItemInput[];
  @IsOptional() @IsUUID() customerId?: string;
}
