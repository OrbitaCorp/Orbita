import { IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizedEmail } from '../../common/decorators/normalized-email.decorator';

export class RegisterBusinessDto {
  @IsString() ownerName!: string;
  @NormalizedEmail() email!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
  @IsString() businessName!: string;
}
