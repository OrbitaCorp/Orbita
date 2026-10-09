import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

// Publicar en Instagram la foto de un producto con el texto que escribió el dueño. 2200 es el máximo de
// caracteres de un texto de Instagram.
export class PublicarInstagramDto {
  @IsUUID() productId!: string;
  @IsString() @MinLength(1) @MaxLength(2200) caption!: string;
}
