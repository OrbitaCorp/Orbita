import { IsOptional, IsEmail, MaxLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeEmail } from '../../common/decorators/normalized-email.decorator';

// Restablecer la contraseña de un admin de plataforma desde Admins. `personalEmail` (opcional) es a
// donde se manda la contraseña temporal; si no viene se usa el que la cuenta ya tiene guardado.
export class ResetAdminPasswordDto {
  @IsOptional()
  @ValidateIf((_o, v) => typeof v === 'string' && v.trim() !== '')
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail() @MaxLength(120)
  personalEmail?: string;
}
