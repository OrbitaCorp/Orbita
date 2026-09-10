import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { NormalizedEmail } from '../../common/decorators/normalized-email.decorator';

// (RBT-630) Edición del perfil del cliente del storefront. Todos opcionales:
// el cliente puede tocar solo el campo que quiera. El email, si viene, se
// valida único DENTRO del negocio (ver MeService.updateProfile).
//
// Auditoría interna 10/09, ítem `api.me`: mismos topes que UpsertCustomerDto
// (el alta desde el panel), email normalizado, y la contraseña actual para
// cambiar el email.
export class UpdateMeDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) firstName?: string;
  @IsOptional() @IsString() @MaxLength(120) lastName?: string;
  @IsOptional() @NormalizedEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(30) dni?: string;
  @IsOptional() @IsDateString() birthDate?: string;

  // Obligatoria solo si el email cambia de verdad (la pantalla de perfil manda
  // el email en cada guardado).
  @IsOptional() @IsString() @MaxLength(128) currentPassword?: string;
}
