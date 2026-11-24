import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsNumber, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// "Actualizar precios con Excel": el dueño exporta el catálogo (una fila por
// variante, con su código), cambia los precios y lo vuelve a subir. Solo
// precios: el stock del Excel es el del momento de exportar y pisarlo
// deshacería las ventas que hubo entre medio.
export const MAX_FILAS_PRECIOS_LOTE = 5000;
const MAX_PRECIO = 1_000_000_000; // mismo tope que create-product.dto.ts

class PrecioDeVariante {
  @IsUUID() variantId!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01, { message: 'El precio tiene que ser mayor a $0' }) @Max(MAX_PRECIO) price!: number;
}

export class PreciosLoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_FILAS_PRECIOS_LOTE)
  @ValidateNested({ each: true })
  @Type(() => PrecioDeVariante)
  items!: PrecioDeVariante[];

  // true = no guarda nada: devuelve qué cambiaría, para el resumen previo.
  @IsOptional() @IsBoolean() simular?: boolean;
}
