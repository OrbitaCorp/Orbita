import { IsString, Length, MaxLength, MinLength } from 'class-validator';

export class AcceptInvitationDto {
  /** Secreto aleatorio de invitación (32 bytes en hex), generado en members.invite(). */
  @IsString()
  @Length(64, 64)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
