import { IsEmail, IsString, MinLength } from 'class-validator';

// El negocio se identifica vía el header X-Business-Slug (mismo mecanismo
// que usa AuthGuard para todo el resto de la API), no en el body.
// Omitir el header = login de panel (se busca en members por email).
// Enviar el header = login de storefront (se busca en customers de ese negocio).
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
