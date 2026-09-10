import { IsDefined, IsEmail, IsString, IsUrl, Matches, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// WHOIS — el titular ante el registrador (Vercel). Campos mínimos que pide
// la API de Vercel para la mayoría de los TLD (ver
// GET /v1/registrar/domains/{domain}/contact-info/schema para los que piden
// más — no cubierto en esta pasada, ver plan).
//
// Topes de largo: auditoría interna 10/09, ítem `api.domains`.
export class DomainContactDto {
  @IsString() @MaxLength(60) firstName!: string;
  @IsString() @MaxLength(60) lastName!: string;
  @IsEmail() @MaxLength(254) email!: string;
  // E.164 (+549...) — mismo formato que exige la API de Vercel.
  @IsString() @Matches(/^\+\d{8,15}$/, { message: 'Teléfono inválido (formato +5491122334455)' }) phone!: string;
  @IsString() @MaxLength(200) address1!: string;
  @IsString() @MaxLength(100) city!: string;
  @IsString() @MaxLength(100) state!: string;
  @IsString() @MaxLength(20) zip!: string;
  // ISO 3166-1 alpha-2 (ej: "AR").
  @IsString() @Matches(/^[A-Z]{2}$/, { message: 'País inválido (código ISO de 2 letras, ej: AR)' }) country!: string;
}

export class CheckoutDomainPurchaseDto {
  @IsString()
  @MaxLength(253)
  @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i, {
    message: 'Formato de dominio inválido (ej: tutienda.com)',
  })
  domain!: string;

  // @ValidateNested solo no exige que `contact` exista: sin @IsDefined, un
  // body sin contacto llegaba al service y rompía con un 500.
  @IsDefined() @ValidateNested() @Type(() => DomainContactDto) contact!: DomainContactDto;

  // A dónde vuelve el navegador después de pagar — el panel ya sabe la URL
  // exacta de la pantalla de Dominios (con su ruteo de admin), más simple y
  // menos frágil que reconstruir esa ruta del lado del backend. Riesgo bajo:
  // es solo el destino del redirect del NAVEGADOR después de pagar, la
  // confirmación real del pago es server-to-server vía webhook, nunca
  // depende de este valor. Con protocolo http(s) obligatorio.
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ['https', 'http'] })
  @MaxLength(2000)
  returnUrl!: string;
}
