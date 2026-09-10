import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { RegisterBusinessDto } from '../../onboarding/dto/register-business.dto';
import { EsSubdominio } from '../../common/utils/subdominio';

// Datos del wizard de onboarding (ver WizardData en apps/web/src/lib/api.ts),
// sin los campos de cuenta (esos van en `account`, reusando RegisterBusinessDto).
// Todo opcional: el wizard permite avanzar sin completar cada paso, igual que
// UpdateOnboardingBusinessDto/UpdateBusinessConfigDto/UpdateBranchDto de los
// que este DTO toma prestada la validación.
export class PendingWizardDto {
  @IsOptional() @IsString() rubro?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) subrubros?: string[];
  @IsOptional() @IsString() descripcion?: string;
  @IsOptional() @IsString() telefono?: string;

  // '' = no eligió (se queda con el auto-generado). Si eligió, la regla única
  // de subdominio (auditoría interna 10/09, ítem `api.businesses`): se valida
  // acá, ANTES de cobrar, porque después del pago updateDraft() lo rechazaría
  // y el negocio se quedaría con el subdominio auto-generado sin avisar.
  @IsOptional()
  @IsString()
  @ValidateIf((o: PendingWizardDto) => !!o.subdominio)
  @EsSubdominio()
  subdominio?: string;

  @IsOptional() @IsIn(['ecommerce', 'vidriera', '']) modoVenta?: string;

  @IsOptional() @IsString() direccion?: string;
  @IsOptional() @IsLatitude() latitude?: number;
  @IsOptional() @IsLongitude() longitude?: number;
  @IsOptional() @IsBoolean() operatesPhysical?: boolean;
  @IsOptional() @IsBoolean() operatesOnline?: boolean;

  @IsOptional() @IsArray() @IsString({ each: true }) pagos?: string[];
  @IsOptional() @IsString() transferAlias?: string;

  @IsOptional() @IsIn(['solo', 'mini', 'medio', 'grande', '']) teamSize?: string;

  // data-URL completa (data:image/png;base64,...), la misma que ya arma el
  // wizard hoy para completeOnboarding()/uploadLogo().
  @IsOptional() @IsString() logoDataUrl?: string;
}

export class StartPendingCheckoutDto {
  // @ValidateNested() por sí solo NO exige que la propiedad exista — si el
  // body no manda `account`/`wizard`, la cascada de validación se salta
  // entera y el service recibe `undefined`. @IsDefined() cierra ese hueco:
  // sin esto, un body vacío llegaba hasta el service y crasheaba con un 500
  // en vez de un 400 (confirmado contra producción al desplegar este cambio).
  @IsDefined()
  @ValidateNested()
  @Type(() => RegisterBusinessDto)
  account!: RegisterBusinessDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => PendingWizardDto)
  wizard!: PendingWizardDto;

  // Código de descuento de plataforma (opcional). Se valida en el service
  // contra platform_discount_codes; si no existe o no está vigente, el alta se
  // rechaza en vez de cobrar el precio lleno sin avisar.
  @IsOptional() @IsString() discountCode?: string;

  // Tarjeta elegida en el alta — determina el monto de bienvenida que se
  // cobra ACÁ (cada tarjeta tiene el suyo, ver BIENVENIDA_TIERS en
  // subscriptions.service.ts) y qué plan se activa cuando termine. Acotado a
  // las 2 keys que se ofrecen en el checkout (RBT — rediseño "Base"/"Base +
  // Avanzado", 2026-09) — 'semestral'/'anual' siguen existiendo pero solo
  // como cambio de plan desde el panel, no en el alta (ver ChangePlanDto).
  @IsIn(['mensual', 'mensualAvanzado'])
  plan!: 'mensual' | 'mensualAvanzado';
}
