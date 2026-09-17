import { IsString, Matches } from 'class-validator';

export class ConfirmarEmailDto {
  // Exactamente 6 dígitos: cualquier otra cosa ni llega a consultar la base.
  @IsString()
  @Matches(/^\d{6}$/, { message: 'El código son 6 números' })
  code!: string;
}
