import { IsEmail, IsString, IsUrl, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// WHOIS — el titular ante el registrador (Vercel). Campos mínimos que pide
// la API de Vercel para la mayoría de los TLD (ver
// GET /v1/registrar/domains/{domain}/contact-info/schema para los que piden
// más — no cubierto en esta pasada, ver plan).
export class DomainContactDto {
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsEmail() email!: string;
  // E.164 (+549...) — mismo formato que exige la API de Vercel.
  @IsString() @Matches(/^\+\d{8,15}$/, { message: 'Teléfono inválido (formato +5491122334455)' }) phone!: string;
  @IsString() address1!: string;
  @IsString() city!: string;
  @IsString() state!: string;
  @IsString() zip!: string;
  // ISO 3166-1 alpha-2 (ej: "AR").
  @IsString() @Matches(/^[A-Z]{2}$/, { message: 'País inválido (código ISO de 2 letras, ej: AR)' }) country!: string;
}

export class CheckoutDomainPurchaseDto {
  @IsString()
  @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i, {
    message: 'Formato de dominio inválido (ej: tutienda.com)',
  })
  domain!: string;

  @ValidateNested() @Type(() => DomainContactDto) contact!: DomainContactDto;

  // A dónde vuelve el navegador después de pagar — el panel ya sabe la URL
  // exacta de la pantalla de Dominios (con su ruteo de admin), más simple y
  // menos frágil que reconstruir esa ruta del lado del backend. Riesgo bajo:
  // es solo el destino del redirect del NAVEGADOR después de pagar, la
  // confirmación real del pago es server-to-server vía webhook, nunca
  // depende de este valor.
  @IsUrl({ require_tld: false }) returnUrl!: string;
}
