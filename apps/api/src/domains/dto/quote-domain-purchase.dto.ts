import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class QuoteDomainPurchaseDto {
  // Mismo patrón laxo que LinkDomainDto — la validación fuerte de si existe
  // la hace Vercel al consultar disponibilidad.
  @IsString()
  @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i, {
    message: 'Formato de dominio inválido (ej: tutienda.com)',
  })
  domain!: string;

  // Fijo en 1 en el form del panel esta pasada (ver plan) — el campo queda
  // opcional/configurable para cuando se exponga un selector de años.
  @IsOptional() @IsInt() @Min(1) @Max(10) years?: number;
}
