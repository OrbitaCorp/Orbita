import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { BACKGROUND_STYLE_KEYS, SIN_FONDO_KEY } from '../background-styles';

export class GenerateBackgroundDto {
  // Key del catálogo curado (ver background-styles.ts) — "madera",
  // "marmol_plantas", "lino_flores", etc. — o SIN_FONDO_KEY para no
  // componer nada (mismo resultado que el toggle "Quitar fondo" de
  // siempre). Si viene vacío, se usa DEFAULT_BACKGROUND_STYLE.
  @IsOptional()
  @IsIn([...BACKGROUND_STYLE_KEYS, SIN_FONDO_KEY])
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
