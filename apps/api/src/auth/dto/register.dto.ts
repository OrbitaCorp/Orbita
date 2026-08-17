import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// El negocio se identifica vía el header X-Business-Slug (mismo mecanismo
// que usa AuthGuard para todo el resto de la API), no en el body.
export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  firstName!: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
