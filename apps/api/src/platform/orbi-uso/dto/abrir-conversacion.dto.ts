import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

// Se recorta ANTES de validar el largo: un detalle de puros espacios no es una justificación.
const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class AbrirConversacionDto {
  @IsIn(['soporte', 'abuso', 'calidad'])
  motivo!: 'soporte' | 'abuso' | 'calidad';

  /** Por qué se abre esta conversación en concreto: queda en el registro de accesos. */
  @Transform(recortar)
  @IsString()
  @Length(10, 500)
  detalle!: string;

  @Transform(recortar)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ticket?: string;
}
