import { IsInt, Max, Min, ValidateIf } from 'class-validator';

/** Tope de un miembro como % del cupo del negocio. null = sin tope (usa todo el cupo). */
export class TopeMiembroDto {
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(10)
  @Max(100)
  topePorcentaje!: number | null;
}
