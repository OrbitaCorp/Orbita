import { IsIn, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateCreditNoteDto {
  @IsUUID() orderId!: string;
  @IsOptional() @IsUUID() returnId?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsNumber() @Min(0.01) amount!: number;
  @IsIn(['BALANCE', 'REFUND']) type!: string;
}
