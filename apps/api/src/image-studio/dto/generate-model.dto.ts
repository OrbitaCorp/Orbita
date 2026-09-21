import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateModelDto {
  // Descripción libre del resultado deseado (ej. "modelo mujer, fondo urbano").
  // Si viene vacío, se usa una consigna genérica — ver PROMPT_MODELO_DEFAULT.
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;
}
