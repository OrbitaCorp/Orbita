import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

// "2x1 y 3x2" (paquete Avanzado, RBT-675) — un solo config por negocio, mismo
// criterio que UpsertPromoModalDto/UpsertGameDto. A diferencia de esos, esto
// SÍ termina creando un Discount real (BUY_X_PAY_Y) — ver TwoForOneService.
// `llevaCantidad`/`pagaCantidad` son la "X"/"Y" de "llevá X, pagá Y"; la
// validación cruzada (Y < X, alcance requiere ids) vive en el service, mismo
// patrón que DiscountsService#validarReglas. Topes desde la auditoría interna
// del 10/09 (ítem api.two-for-one).
export class UpsertTwoForOneDto {
  @IsBoolean() isActive!: boolean;
  @IsInt() @Min(2) @Max(100) llevaCantidad!: number;
  @IsInt() @Min(1) @Max(99) pagaCantidad!: number;
  @IsIn(['PRODUCT', 'CATEGORY']) alcance!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @IsUUID('4', { each: true }) productIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('4', { each: true }) categoryIds?: string[];
}
