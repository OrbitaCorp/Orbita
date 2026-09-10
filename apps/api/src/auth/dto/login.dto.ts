import { IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizedEmail } from '../../common/decorators/normalized-email.decorator';

// El negocio se identifica vía el header X-Business-Slug (mismo mecanismo
// que usa AuthGuard para todo el resto de la API), no en el body.
// Omitir el header = login de panel (se busca en members por email).
// Enviar el header = login de storefront (se busca en customers de ese negocio).
export class LoginDto {
  @NormalizedEmail()
  email!: string;

  // MaxLength obligatorio: argon2 hashea lo que le llegue y el body admite
  // hasta 10 MB, así que sin tope una sola request puede quemar CPU del
  // servidor a voluntad (auditoría interna 09/09).
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
