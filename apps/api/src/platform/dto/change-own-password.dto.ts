import { IsString, MaxLength, MinLength } from 'class-validator';

// Un admin de plataforma cambia su propia contraseña (típicamente la temporal con la que entró). Pide la
// actual como verificación; mismos topes que el cambio de contraseña de los miembros del panel.
export class ChangeOwnPasswordDto {
  @IsString()
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
