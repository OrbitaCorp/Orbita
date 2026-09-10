import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizedEmail } from '../../common/decorators/normalized-email.decorator';

// El negocio se identifica vía el header X-Business-Slug (mismo mecanismo
// que usa AuthGuard para todo el resto de la API), no en el body.
export class RegisterDto {
  @NormalizedEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  firstName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}
