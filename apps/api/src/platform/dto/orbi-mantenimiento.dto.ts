import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ActivarMantenimientoDto {
  /** Por qué se pone en mantenimiento (se muestra a los admins en el mail y en el panel). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;
}
