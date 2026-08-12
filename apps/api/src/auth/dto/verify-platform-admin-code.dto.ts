import { IsEmail, IsString, Length } from 'class-validator';

// Segundo factor del login de platform admin (RBT-647): el código de 6
// dígitos que se manda por mail después de validar la contraseña (o el
// login con Google), antes de emitir la sesión real.
export class VerifyPlatformAdminCodeDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}
