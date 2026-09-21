import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateBackgroundDto {
  // Descripción libre del fondo deseado (ej. "fondo de estudio con luz cálida",
  // "sobre una mesada de madera clara"). Si viene vacío, se usa un fondo de
  // estudio neutro por default — ver PROMPT_FONDO_DEFAULT en el service.
  @IsOptional()
  @IsString()
  @MaxLength(300)
  descripcion?: string;
}
