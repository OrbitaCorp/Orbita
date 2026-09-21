import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { BACKGROUND_STYLE_KEYS } from '../background-styles';

export class GenerateBackgroundDto {
  // Key del catálogo curado (ver background-styles.ts) — "madera",
  // "marmol_plantas", "lino_flores", etc. Si viene vacío, se usa
  // DEFAULT_BACKGROUND_STYLE (estudio neutro).
  @IsOptional()
  @IsIn(BACKGROUND_STYLE_KEYS)
  estilo?: string;

  // Ajuste libre ADEMÁS del estilo elegido (ej. "con tonos más fríos", "sin
  // sombras tan marcadas") — no reemplaza al catálogo, lo afina.
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;
}
