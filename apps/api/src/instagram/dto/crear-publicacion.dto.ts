import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

// Un elemento de la publicación: una foto del catálogo, o un archivo subido desde la computadora.
export class ItemPublicacionDto {
  @IsIn(['producto', 'subida']) origen!: 'producto' | 'subida';
  /** producto: la dirección de la foto del producto. subida: la ruta que devolvió la subida. */
  @IsString() @MinLength(1) @MaxLength(1000) ref!: string;
  @IsIn(['image', 'video']) tipo!: 'image' | 'video';
}

// Publicar en Instagram: de 1 a 10 elementos (varias fotos y/o videos forman un carrusel) y el texto que
// escribió el dueño. 2200 es el máximo de caracteres de un texto de Instagram. El producto es opcional: una
// publicación puede ser solo de archivos subidos.
export class CrearPublicacionDto {
  @IsOptional() @IsUUID() productId?: string;
  @IsString() @MaxLength(2200) caption!: string;
  /** Lienzo de las fotos: cuadrado (1:1) o vertical (4:5). */
  @IsIn(['cuadrado', 'vertical']) formato!: 'cuadrado' | 'vertical';
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => ItemPublicacionDto) items!: ItemPublicacionDto[];
}

// Pedir la dirección firmada para subir un video directo al almacenamiento.
export class SubirVideoDto {
  @IsString() @MaxLength(60) tipo!: string;
  @IsInt() @Min(1) bytes!: number;
}
