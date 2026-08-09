import { IsString, IsOptional, IsInt, IsUUID, IsEmail, IsArray, IsIn, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

class CheckoutItemInput {
  @IsUUID() variantId!: string;
  @IsInt() @Min(1) quantity!: number;
}
class CheckoutBuyerInput {
  @IsString() name!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() phone?: string;
}
export class CheckoutDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => CheckoutItemInput) items!: CheckoutItemInput[];
  @ValidateNested() @Type(() => CheckoutBuyerInput) buyer!: CheckoutBuyerInput;
  // Referencia a una dirección YA guardada del cliente (Me/Addresses,
  // RBT-629) — el checkout no arma direcciones sueltas, así "Mis pedidos"
  // y "Mis direcciones" siempre hablan de las mismas direcciones reales.
  // Opcional: no hace falta para retiro en local.
  @IsOptional() @IsUUID() shippingAddressId?: string;
  // 'MERCADOPAGO' está en el modelo desde antes pero el checkout todavía no
  // la ofrece como opción real (ver comentario en StorefrontService.getConfig) —
  // queda documentada acá para cuando exista la conexión OAuth.
  @IsIn(['MERCADOPAGO', 'CASH', 'TRANSFER', 'PICKUP']) paymentMethod!: string;
  @IsOptional() @IsString() couponCode?: string;
}
