import { IsIn, IsOptional } from 'class-validator';

// Query params de GET /image-studio/background-styles. Catálogo unificado
// (ver ImageStudioController.listBackgroundStyles()): siempre devuelve el
// mismo BACKGROUND_STYLES, sin distinción de modo.
export class ListBackgroundStylesDto {
  // Sin efecto hoy — el catálogo no filtra por photoType (ver comentario de
  // listBackgroundStyles()). Se acepta porque el panel lo sigue mandando.
  @IsOptional()
  @IsIn(['flat', 'volume'])
  photoType?: 'flat' | 'volume';
}
