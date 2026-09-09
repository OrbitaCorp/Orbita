import { IsString, Length, Matches } from 'class-validator';
import { NormalizedEmail } from '../../common/decorators/normalized-email.decorator';

export class VerifyResetCodeDto {
  @NormalizedEmail()
  email!: string;

  // 6 dígitos exactos: el código se genera con randomInt, no hay otra forma válida.
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}
