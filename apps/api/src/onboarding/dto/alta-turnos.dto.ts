import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

// Lo que el alta de Turnos (apps/web/src/modules/onboarding/alta) deja armado
// para que el negocio nazca con su agenda: el horario, la seña, la primera
// agenda (la del dueño, o el primer espacio en los rubros por sala) y los
// servicios. Viaja dentro del wizard del checkout (PendingWizardDto.turnos)
// y lo aplica OnboardingService.sembrarTurnos() al crearse el negocio. Los
// topes son los del catálogo de reservas (UpsertServicioDto, UpsertRecursoDto).

export class AgendaAltaDto {
  @IsIn(['PROFESIONAL', 'ESPACIO']) tipo!: 'PROFESIONAL' | 'ESPACIO';
  @IsString() @MinLength(1) @MaxLength(120) nombre!: string;
  /** Cómo se llama a quien atiende en el rubro ("Barbero"), o "Espacio". */
  @IsString() @MinLength(1) @MaxLength(60) rol!: string;
  @Matches(/^#[0-9a-fA-F]{6}$/) color!: string;
}

export class ServicioAltaDto {
  @IsString() @MinLength(1) @MaxLength(120) nombre!: string;
  @IsInt() @Min(5) @Max(1440) duracionMinutos!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100_000_000) precio!: number;
}

export class AltaTurnosDto {
  /** El rubro de Turnos (barberia, psicologia…): va también en Business.subrubros. */
  @IsString() @Matches(/^[a-z0-9-]{2,40}$/) rubro!: string;
  /** El horario del negocio, como ReservaConfig.horario: { "0".."6": [[desde, hasta]] }, 0 = domingo. */
  @IsDefined() @IsObject() horario!: Record<string, [number, number][]>;
  @IsInt() @Min(0) @Max(100) senaPorcentaje!: number;
  @IsDefined() @ValidateNested() @Type(() => AgendaAltaDto) agenda!: AgendaAltaDto;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => ServicioAltaDto) servicios!: ServicioAltaDto[];
}
