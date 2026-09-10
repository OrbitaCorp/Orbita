import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { EsSubdominio } from '../../common/utils/subdominio';

// Solo aplicable mientras el negocio sigue "en configuración" (isActive: false).
// Una vez publicado, cambiar subdomain/mode pasa por flujos dedicados con sus
// propias validaciones (ver PENDIENTES.md).
//
// Topes y regla de subdominio: auditoría interna 10/09, ítem `api.businesses`
// (mismos topes que UpdateBusinessDto; el subdominio sigue la regla única de
// common/utils/subdominio.ts).
export class UpdateOnboardingBusinessDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(60) industry?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;

  @IsOptional()
  @IsString()
  @EsSubdominio()
  subdomain?: string;

  @IsOptional() @IsIn(['FULL', 'SHOWCASE']) mode?: 'FULL' | 'SHOWCASE';

  // Wizard RBT-293 — pasos posteriores al modelo básico de negocio
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(60, { each: true }) subrubros?: string[];
  @IsOptional() @IsIn(['solo', 'mini', 'medio', 'grande']) teamSize?: string;
  @IsOptional() @IsBoolean() operatesPhysical?: boolean;
  @IsOptional() @IsBoolean() operatesOnline?: boolean;
}
