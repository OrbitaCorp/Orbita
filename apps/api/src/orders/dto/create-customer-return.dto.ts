import { IsInt, IsString, IsUUID, MaxLength, Min } from 'class-validator';

// Alta de devolución desde el storefront. A diferencia de CreateReturnDto
// (panel) no manda `amount` ni `refundMethod`: el monto lo calcula el
// backend (ReturnsService.createForCustomer) a partir del renglón real del
// pedido, y el método siempre es nota de crédito.
export class CreateCustomerReturnDto {
  @IsUUID() orderItemId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsString() @MaxLength(500) reason!: string;
}
