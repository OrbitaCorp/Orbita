import { IsIn, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

// Tope del monto (auditoría interna 10/09, ítem `api.returns`); el tope real
// —no superar el total del pedido— lo controla el service.
export class CreateCreditNoteDto {
  @IsUUID() orderId!: string;
  @IsOptional() @IsUUID() returnId?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsNumber() @Min(0.01) @Max(1_000_000_000) amount!: number;
  @IsIn(['BALANCE', 'REFUND']) type!: string;
}
