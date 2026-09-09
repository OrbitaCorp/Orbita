import { IsString, Length, Matches } from 'class-validator';
import { NormalizedEmail } from '../../common/decorators/normalized-email.decorator';

// Segundo factor del login de platform admin (RBT-647): el código de 6
// dígitos que se manda por mail después de validar la contraseña (o el
// login con Google), antes de emitir la sesión real.
export class VerifyPlatformAdminCodeDto {
  @NormalizedEmail()
  email!: string;

  // 6 dígitos exactos: el código se genera con randomInt, no hay otra forma válida.
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}
