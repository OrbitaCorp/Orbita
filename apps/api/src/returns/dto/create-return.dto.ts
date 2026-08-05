import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

// (Fase 3 — Ale) El alta de una devolución. `quantity` y `amount` van con Min:
// sin eso, una cantidad negativa hacía que el reingreso de stock al aprobar
// RESTARA unidades del inventario en vez de sumarlas.
export class CreateReturnDto {
  @IsUUID() orderId!: string;
  @IsOptional() @IsUUID() orderItemId?: string;
  @IsInt() @Min(1) quantity!: number;
  @IsNumber() @Min(0.01) amount!: number;
  @IsString() @MaxLength(500) reason!: string;
  @IsIn(['CREDIT_NOTE', 'REFUND']) refundMethod!: string;
}
