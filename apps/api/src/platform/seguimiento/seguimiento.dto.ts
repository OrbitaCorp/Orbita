import { IsIn, IsString, IsUUID, Length } from 'class-validator';
import { ETAPAS, type Etapa } from './etapas';

export class BorradorSeguimientoDto {
  @IsUUID()
  businessId!: string;

  @IsIn(ETAPAS as unknown as string[], { message: 'Esa etapa de seguimiento no existe' })
  etapa!: Etapa;

  @IsUUID()
  senderId!: string;
}

export class VistaPreviaSeguimientoDto extends BorradorSeguimientoDto {
  @IsString()
  @Length(0, 20000)
  body!: string;
}

export class EnviarSeguimientoDto extends VistaPreviaSeguimientoDto {
  @IsString()
  @Length(3, 200, { message: 'El asunto tiene que tener entre 3 y 200 caracteres' })
  subject!: string;
}
