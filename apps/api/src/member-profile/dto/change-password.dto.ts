import { IsString, MaxLength, MinLength } from 'class-validator';

// (Fase 4 — Alex) Cambio de contraseña desde "Mi perfil" del panel: pide la
// actual como verificación (a diferencia del reset por mail, que valida con
// el código de un solo uso).
//
// Tope de 128 en las dos (auditoría interna 10/09, ítem `api.member-profile`):
// mismo criterio que se aplicó a auth el 09/09 — argon2 sobre un string de
// hasta 10 MB (el tope del body) es un costo que no hace falta regalar.
export class ChangePasswordDto {
  @IsString()
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
