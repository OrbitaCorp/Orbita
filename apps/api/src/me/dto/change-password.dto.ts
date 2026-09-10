import { IsString, MaxLength, MinLength } from 'class-validator';

// (RBT-631) Cambio de contraseña estando logueado: exige la actual (se verifica
// con argon2) además de la nueva. Tope de 128 en las dos (auditoría interna
// 10/09, ítem `api.me`: mismo criterio que auth).
export class ChangePasswordDto {
  @IsString() @MaxLength(128) currentPassword!: string;
  @IsString() @MinLength(8) @MaxLength(128) newPassword!: string;
}
