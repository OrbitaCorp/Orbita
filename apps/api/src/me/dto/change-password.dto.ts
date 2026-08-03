import { IsString, MinLength } from 'class-validator';

// (RBT-631) Cambio de contraseña estando logueado: exige la actual (se verifica
// con argon2) además de la nueva.
export class ChangePasswordDto {
  @IsString() currentPassword!: string;
  @IsString() @MinLength(8) newPassword!: string;
}
