import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { BACKGROUND_STYLE_KEYS, SIN_FONDO_KEY, BLANCO_LISO_KEY, NEGRO_LISO_KEY } from '../background-styles';

export class GenerateBackgroundDto {
  // Sin efecto en el flujo actual (ImageStudioService.generateBackground()
  // es único: Workers AI con fallback a modelo local, sin distinción por
  // photoType) — se acepta igual porque el panel lo sigue mandando desde
  // Product.photoType, y con `whitelist: true` (sin forbidNonWhitelisted)
  // el ValidationPipe lo descarta solo si algún día se saca del lado del
  // panel. No reactivar sin revisar generateBackground() primero.
  @IsOptional()
  @IsIn(['flat', 'volume'])
  photoType?: 'flat' | 'volume';

  // Key del catálogo curado (ver background-styles.ts) — "madera",
  // "marmol_plantas", "lino_flores", etc. — o SIN_FONDO_KEY para no
  // componer nada (mismo resultado que el toggle "Quitar fondo" de
  // siempre), o BLANCO_LISO_KEY/NEGRO_LISO_KEY para fondo blanco o negro
  // puro de estudio. Si viene vacío, se usa DEFAULT_BACKGROUND_STYLE.
  @IsOptional()
  @IsIn([...BACKGROUND_STYLE_KEYS, SIN_FONDO_KEY, BLANCO_LISO_KEY, NEGRO_LISO_KEY])
  estilo?: string;

  // Ajuste libre ADEMÁS del estilo elegido (ej. "con tonos más fríos", "sin
  // sombras tan marcadas") — no reemplaza al catálogo, lo afina. Sin efecto
  // si estilo es SIN_FONDO_KEY (no hay fondo que ajustar).
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;

  // Alternativa a subir el archivo: la URL pública de una foto YA GUARDADA
  // del producto (edición, no alta) — el backend la baja server-side (sin
  // problema de CORS, a diferencia de bajarla desde el navegador) y valida
  // que apunte a nuestro propio storage antes de tocarla, ver
  // ImageStudioService#resolverImagenPorUrl.
  @IsOptional()
  @IsUrl({ require_protocol: true })
  imageUrl?: string;
}
