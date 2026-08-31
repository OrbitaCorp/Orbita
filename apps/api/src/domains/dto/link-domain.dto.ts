import { IsString, Matches } from 'class-validator';

export class LinkDomainDto {
  // Mismo criterio laxo que subdomain de onboarding, pero para un dominio
  // completo (con su TLD) — la validación fuerte de si existe/resuelve la
  // hace Vercel al agregarlo, esto solo corta basura obvia antes de gastar
  // una llamada a su API.
  @IsString()
  @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i, {
    message: 'Formato de dominio inválido (ej: tefaltacalleok.com)',
  })
  domain!: string;
}
