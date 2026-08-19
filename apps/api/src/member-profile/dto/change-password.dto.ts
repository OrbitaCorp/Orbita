import { IsString, MinLength } from 'class-validator';

// (Fase 4 — Alex) Cambio de contraseña desde "Mi perfil" del panel: pide la
// actual como verificación (a diferencia del reset por mail, que valida con
// el código de un solo uso).
export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
