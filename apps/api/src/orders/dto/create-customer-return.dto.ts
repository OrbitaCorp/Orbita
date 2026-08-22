import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

// Alta de devolución desde el storefront. A diferencia de CreateReturnDto
// (panel) no manda `amount`: el monto lo calcula el backend
// (ReturnsService.createForCustomer) a partir del renglón real del pedido.
// `refundMethod` es opcional: si el negocio solo tiene un método habilitado
// en Configuración (BusinessConfig.returnsCreditNoteEnabled/
// returnsMpRefundEnabled), no hace falta mandarlo — el backend lo completa
// solo. Si tiene los dos habilitados, es obligatorio elegir.
export class CreateCustomerReturnDto {
  @IsUUID() orderItemId!: string;
  @IsInt() @Min(1) quantity!: number;
  @IsString() @MaxLength(500) reason!: string;
  @IsOptional() @IsIn(['CREDIT_NOTE', 'REFUND']) refundMethod?: string;
}
