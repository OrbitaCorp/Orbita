import { IsString, IsOptional, IsBoolean, MaxLength, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

// Cupón de la plantilla Vidriera: el bloque oscuro con el código en caja
// punteada. Es texto que la portada muestra tal cual (React lo escapa solo,
// no se interpola en ningún <style> como los colores/fuentes de acá al lado)
// — los máximos son por diseño, no por seguridad: el título se dibuja a 27px
// y el código en monoespaciada con letter-spacing, así que un texto largo
// desborda la caja en vez de avisar.
export class HomeCouponDto {
  @IsString() @MaxLength(60) titulo!: string;
  @IsString() @MaxLength(140) bajada!: string;
  @IsString() @MaxLength(24) codigo!: string;
}

// Contenido propio de UNA plantilla de Home. Cada clave la usa una plantilla
// distinta; se van sumando a medida que una plantilla nueva necesite algo que
// las demás no tienen. Ver el porqué del JSON (en vez de una columna por
// campo) en el comentario de `homeTemplateData` en schema.prisma.
export class HomeTemplateDataDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => HomeCouponDto)
  cupon?: HomeCouponDto;

  // Escaparate: por default el header solo muestra el nombre de la tienda en
  // texto (su diseño original, sin ícono) — en `true`, se muestra además el
  // logo subido (o el degradé genérico si no subió ninguno). Ver
  // StorefrontChrome.tsx § logoIcono.
  @IsOptional()
  @IsBoolean()
  mostrarIconoLogo?: boolean;
}
