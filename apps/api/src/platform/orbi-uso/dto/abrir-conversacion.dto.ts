import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class AbrirConversacionDto {
  @IsIn(['soporte', 'abuso', 'calidad'])
  motivo!: 'soporte' | 'abuso' | 'calidad';

  /** Por qué se abre esta conversación en concreto: queda en el registro de accesos. */
  @IsString()
  @Length(10, 500)
  detalle!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ticket?: string;
}
