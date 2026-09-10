import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { URL_IMAGEN, URL_IMAGEN_MENSAJE } from '../../businesses/dto/url-imagen';

// Topes y formatos (auditoría interna 10/09, ítem `api.categories`): antes
// eran strings libres que la tienda pinta. Holgados contra producción (nombre
// más largo: 28; ícono: un emoji o un nombre corto; colores, todos hex).
export class UpsertCategoryDto {
  @IsString() @IsNotEmpty() @MaxLength(60) name!: string;
  @IsOptional() @IsString() @MaxLength(80) slug?: string;
  // Un emoji o el nombre de un ícono ("shirt", "tag").
  @IsOptional() @IsString() @MaxLength(40) icon?: string;
  // '' = sin color (así limpia el campo el panel).
  @IsOptional() @Matches(/^(#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?)?$/, { message: 'color debe ser un color hex' }) color?: string;
  // null explícito = "sacar la imagen" (vuelve a mostrar ícono+color en el
  // storefront); undefined = no tocar el campo. Mismo criterio que logoUrl
  // en update-storefront-config.dto.ts, y la misma regla de URL.
  @IsOptional() @IsString() @MaxLength(1000) @Matches(URL_IMAGEN, { message: URL_IMAGEN_MENSAJE }) imageUrl?: string | null;
  @IsOptional() @IsUUID() parentId?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
