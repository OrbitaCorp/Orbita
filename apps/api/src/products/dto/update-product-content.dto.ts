import { ArrayMaxSize, IsArray, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Un bloque del contenido de la ficha: un video (link de YouTube/Vimeo o el
// archivo subido) con el texto que va al costado. Solo `url` es obligatorio.
// Mismo formato de link que los videos del home (VideoItemDto).
const URL_VIDEO = /^https:\/\/\S+$/;

export class ProductContentBlockDto {
  @IsString() @MaxLength(64) id!: string;

  @IsString()
  @MaxLength(500)
  @Matches(URL_VIDEO, { message: 'Cada video tiene que ser un link https (YouTube, Vimeo, o el archivo del video)' })
  url!: string;

  // La línea chica de arriba del título ("Resistente al agua").
  @IsOptional() @IsString() @MaxLength(60) eyebrow?: string;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(600) text?: string;
  // El botón lleva siempre a la compra de ESTE producto (sube al bloque de
  // compra de la ficha): no hay link que cargar.
  @IsOptional() @IsString() @MaxLength(40) ctaText?: string;
}

// PUT /products/:id/content — reemplaza la lista entera. Tope de 8 bloques:
// más que eso ya no es una ficha, es una página aparte.
export class UpdateProductContentDto {
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => ProductContentBlockDto)
  blocks!: ProductContentBlockDto[];
}
