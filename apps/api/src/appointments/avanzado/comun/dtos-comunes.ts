import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Un cliente nuevo cargado a mano desde el panel (CONTRATO § 0 "Cliente"). */
export class ClienteNuevoDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[\d\s+()-]{8,20}$/, { message: 'El teléfono tiene que tener al menos 8 dígitos.' })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Ese email no es válido.' })
  @MaxLength(254)
  email?: string;
}

/** Medios para cobrar en el local (los de onSiteMethods). */
export const MEDIOS_EN_EL_LOCAL = ['CASH', 'TRANSFER', 'DEBIT_CARD', 'CREDIT_CARD', 'QR'] as const;
export type MedioEnElLocal = (typeof MEDIOS_EN_EL_LOCAL)[number];

export class ConMedioDePagoDto {
  @IsIn(MEDIOS_EN_EL_LOCAL as unknown as string[], { message: 'Elegí cómo se pagó.' })
  method!: MedioEnElLocal;
}

/** Quien compra desde el sitio sin cuenta (packs, gift cards). */
export class CompradorPublicoDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(/^[\d\s+()-]{8,20}$/, { message: 'Faltan dígitos: son 10 con el código de área.' })
  phone!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Ese email no es válido.' })
  @MaxLength(254)
  email?: string;
}
