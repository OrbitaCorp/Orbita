import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

// Topes (auditoría interna 10/09, ítem `api.inventory`): sin máximo, una
// cantidad de 3 mil millones desbordaba la columna Int de Postgres (500).
export class StockEntryDto {
  @IsUUID() variantId!: string;
  @IsOptional() @IsUUID() branch_id?: string;
  @IsInt() @Min(1, { message: 'La cantidad de una entrada debe ser positiva' }) @Max(1_000_000) quantity!: number;
  @IsOptional() @IsUUID() supplierId?: string;
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}
