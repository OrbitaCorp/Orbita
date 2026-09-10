import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

// Topes (auditoría interna 10/09, ítem `api.inventory`). El motivo es
// obligatorio: es lo que queda en el historial de movimientos.
export class StockAdjustmentDto {
  @IsUUID() variantId!: string;
  @IsOptional() @IsUUID() branch_id?: string;
  @IsInt() @Min(-1_000_000) @Max(1_000_000) quantity!: number;
  @IsString() @IsNotEmpty() @MaxLength(200) reason!: string;
}
