import { NormalizedEmail } from '../../common/decorators/normalized-email.decorator';

// El negocio se identifica vía el header X-Business-Slug (mismo mecanismo
// que usa AuthGuard para todo el resto de la API), no en el body.
export class ForgotPasswordDto {
  @NormalizedEmail()
  email!: string;
}
