import { IsInt, IsString, IsUUID, Length, Matches } from 'class-validator';

export class AjusteCupoDto {
  @IsUUID()
  businessId!: string;

  /** Mes al que se suma o resta el ajuste, 'AAAA-MM'. */
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'El mes tiene que tener la forma AAAA-MM' })
  mes!: string;

  /** Créditos a sumar (positivo) o restar (negativo). */
  @IsInt()
  creditos!: number;

  @IsString()
  @Length(5, 300)
  motivo!: string;
}
