import { IsString, MaxLength } from 'class-validator';

// El token de invitación son 64 caracteres hex (members.service.ts).
export class InvitationInfoDto {
  @IsString()
  @MaxLength(128)
  token!: string;
}
