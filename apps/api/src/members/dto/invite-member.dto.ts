import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { NormalizedEmail } from '../../common/decorators/normalized-email.decorator';

// Nombre obligatorio y con tope (auditoría interna 10/09, ítem `api.members`).
export class InviteMemberDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @NormalizedEmail() email!: string;
  @IsUUID() roleId!: string;
}
