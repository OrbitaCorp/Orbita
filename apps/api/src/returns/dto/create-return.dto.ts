import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

// (Fase 3 — Ale) El alta de una devolución. `quantity` y `amount` van con Min:
// sin eso, una cantidad negativa hacía que el reingreso de stock al aprobar
// RESTARA unidades del inventario en vez de sumarlas. Y con Max (auditoría
// interna 10/09, ítem `api.returns`): una cantidad enorme desbordaba el Int.
export class CreateReturnDto {
  @IsUUID() orderId!: string;
  @IsOptional() @IsUUID() orderItemId?: string;
  @IsInt() @Min(1) @Max(10_000) quantity!: number;
  @IsNumber() @Min(0.01) @Max(1_000_000_000) amount!: number;
  @IsString() @MaxLength(500) reason!: string;
  @IsIn(['CREDIT_NOTE', 'REFUND']) refundMethod!: string;
}
