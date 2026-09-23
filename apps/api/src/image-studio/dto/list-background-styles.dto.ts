import { IsIn, IsOptional } from 'class-validator';

// Query params de GET /image-studio/background-styles (Fase 2, 24/09/2026):
// antes devolvía siempre el mismo catálogo (BACKGROUND_STYLES) sin importar
// el modo. Desde que existe el modo premium con catálogo propio
// (PREMIUM_ONLY_STYLES, sin backgroundKeys en R2 — ver background-styles.ts),
// el panel necesita pedir explícitamente cuál quiere ver.
export class ListBackgroundStylesDto {
  // Default 'gratis' — un caller viejo que no mande el query param sigue
  // viendo exactamente el mismo catálogo de siempre.
  @IsOptional()
  @IsIn(['gratis', 'premium'])
  modo?: 'gratis' | 'premium';

  // Solo relevante en modo 'premium': filtra los estilos "podio" (solo
  // productos con volumen) cuando el producto es plano — ver
  // PremiumOnlyStyle.soloVolumen.
  @IsOptional()
  @IsIn(['flat', 'volume'])
  photoType?: 'flat' | 'volume';
}
