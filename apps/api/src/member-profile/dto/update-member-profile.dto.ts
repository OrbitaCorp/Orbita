import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { NormalizedEmail } from '../../common/decorators/normalized-email.decorator';

// Auditoría interna 10/09, ítem `api.member-profile`: nombre con tope, email
// normalizado (la unique de Postgres distingue mayúsculas) y la contraseña
// actual para cambiar el email.
export class UpdateMemberProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @NormalizedEmail()
  email?: string;

  // Obligatoria solo si el email cambia de verdad (el panel manda siempre el
  // email, cambie o no): ver MemberProfileService.updateProfile.
  @IsOptional()
  @IsString()
  @MaxLength(128)
  currentPassword?: string;
}
