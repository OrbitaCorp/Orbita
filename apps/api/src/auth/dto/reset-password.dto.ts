import { IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { NormalizedEmail } from '../../common/decorators/normalized-email.decorator';

export class ResetPasswordDto {
  @NormalizedEmail()
  email!: string;

  // 6 dígitos exactos: el código se genera con randomInt, no hay otra forma válida.
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
