import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, Length,
  Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { MENSAJE_IDS } from '../lib/mensajes';

// DTOs de Configuración (CONTRATO.md § P1.1). Un campo ausente no se toca; en
// los opcionales de texto, null o '' lo borra. Las reglas que dependen del
// rubro o cruzan campos (modalidades posibles, grilla del rubro, horarios) las
// valida el service, con el mensaje que pide el contrato.

const MODALIDADES = ['ON_SITE', 'HOME'];
const METODOS_EN_EL_LOCAL = ['CASH', 'TRANSFER', 'DEBIT_CARD', 'CREDIT_CARD', 'QR'];

export class UpdateBusinessDto {
  @IsString() @Length(2, 80) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string | null;
  @IsOptional() @IsString() @MaxLength(200) address?: string | null;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number | null;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number | null;
  @IsOptional() @IsString() @MaxLength(120) city?: string | null;
  @IsOptional() @IsString() @MaxLength(120) neighborhood?: string | null;
  @IsOptional() @IsString() @MaxLength(60) floor?: string | null;
  @IsOptional() @IsString() @MaxLength(400) directions?: string | null;
  @IsOptional() @IsString() @MaxLength(400) homeZones?: string | null;
  @IsArray() @ArrayMaxSize(2) @ArrayUnique() @IsIn(MODALIDADES, { each: true }) modalities!: ('ON_SITE' | 'HOME')[];
  @IsOptional() @IsString() @MaxLength(40) phone?: string | null;
  @IsOptional() @IsString() @MaxLength(40) whatsapp?: string | null;
  @IsOptional() @IsEmail({}, { message: 'El email no es válido.' }) @MaxLength(254) email?: string | null;
  @IsOptional() @IsString() @MaxLength(100) instagram?: string | null;
}

export class SeccionSitioDto {
  @IsString() @MaxLength(30) id!: string;
  @IsBoolean() on!: boolean;
}

export class AparienciaDto {
  @IsOptional() @IsString() @MaxLength(40) plantilla?: string;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'El color va en formato #RRGGBB.' }) color?: string;
  @IsOptional() @IsString() @MaxLength(40) tipo?: string;
  @IsOptional() @IsInt() @Min(0) @Max(40) radio?: number;
  // '' = la foto de la plantilla. Si no, una subida a R2 (R2_PUBLIC_URL, *.r2.dev) o una de las de fábrica (/turnos/…).
  @IsOptional() @IsString() @MaxLength(500)
  @Matches(/^(|\/turnos\/[\w./-]+|https:\/\/[\w-]+\.r2\.dev\/[\w./%-]+)$/, { message: 'La foto tiene que ser una imagen subida a Órbita.' })
  foto?: string;
  @IsOptional() @IsIn(['relleno', 'borde', 'suave', null]) estiloBoton?: 'relleno' | 'borde' | 'suave' | null;
  @IsOptional() @IsIn(['sangre', 'partido', null]) hero?: 'sangre' | 'partido' | null;
  @IsOptional() @IsBoolean() monograma?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => SeccionSitioDto) secciones?: SeccionSitioDto[];
  @IsOptional() @IsString() @MaxLength(80) nombre?: string;
  @IsOptional() @IsString() @MaxLength(160) frase?: string;
  @IsOptional() @IsString() @MaxLength(40) boton?: string;
}

export class UpdateSiteDto {
  @IsIn(['web', 'simple']) siteForm!: 'web' | 'simple';
  @IsIn(['tarjeta', 'portada', 'partida', 'editorial', 'enlaces']) simpleDesign!: string;
  // null = volver a la apariencia de fábrica del rubro.
  @IsOptional() @ValidateNested() @Type(() => AparienciaDto) appearance?: AparienciaDto | null;
}

export class DiaEspecialInputDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Las fechas van como AAAA-MM-DD.' }) date!: string;
  @IsIn(['CLOSED', 'SPECIAL']) kind!: 'CLOSED' | 'SPECIAL';
  // Tramos [desde, hasta] en minutos: los valida errorTramos() en el service.
  @IsArray() ranges!: unknown[];
  @IsOptional() @IsString() @MaxLength(120) reason?: string | null;
}

export class VacacionesDto {
  @IsBoolean() enabled!: boolean;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Las fechas van como AAAA-MM-DD.' }) from?: string | null;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Las fechas van como AAAA-MM-DD.' }) to?: string | null;
  @IsOptional() @IsString() @MaxLength(400) message?: string | null;
}

export class UpdateScheduleDto {
  // number[][][]: la valida errorSemana() en el service (los mensajes van tal cual en el 400).
  @IsArray() weekSchedule!: unknown[];
  @IsArray() @ArrayMaxSize(60) @ValidateNested({ each: true }) @Type(() => DiaEspecialInputDto) specialDays!: DiaEspecialInputDto[];
  @ValidateNested() @Type(() => VacacionesDto) vacation!: VacacionesDto;
}

export class ReglasReservaDto {
  @IsIn([0, 60, 120, 240, 720, 1440]) minAdvanceMin!: number;
  @IsIn([7, 14, 30, 60, 90]) maxAdvanceDays!: number;
  // Además tiene que estar en grillasDe(rubro): lo mira el service.
  @IsIn([15, 30, 60, 90]) slotMin!: number;
  @IsIn([0, 5, 10, 15]) bufferMin!: number;
  @IsIn(['auto', 'manual']) confirmation!: 'auto' | 'manual';
  @IsBoolean() letChooseResource!: boolean;
  @IsBoolean() offerAnyResource!: boolean;
  @IsIn([0, 1, 2, 3, 5]) maxActivePerCustomer!: number;
  @IsBoolean() waitlistEnabled!: boolean;
  @IsIn([15, 30, 60]) waitlistAcceptMin!: number;
  @IsInt() @Min(1) @Max(500) classDefaultCapacity!: number;
  @IsIn([1, 2, 3, 7, 14]) classOpenDays!: number;
  @IsInt() @Min(0) @Max(500) classMinEnrolled!: number;
  @IsBoolean() askInsurance!: boolean;
  @IsBoolean() askDni!: boolean;
  @IsBoolean() askReason!: boolean;
  @IsBoolean() rescheduleEnabled!: boolean;
  @IsIn([2, 6, 12, 24, 48]) rescheduleUntilHours!: number;
  @IsIn([1, 2, 3]) rescheduleMax!: number;
  @IsBoolean() depositEnabled!: boolean;
  @IsIn(['percent', 'fixed']) depositType!: 'percent' | 'fixed';
  @IsIn(Array.from({ length: 19 }, (_, i) => 10 + i * 5), { message: 'La seña va de 10 % a 100 %, de a 5.' }) depositPercent!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10_000_000) depositFixed!: number;
  @IsBoolean() depositForNoShows!: boolean;
}

export class PoliticaReservaDto {
  @IsIn([0, 2, 6, 12, 24, 48, 72]) cancelUntilHours!: number;
  @IsIn(['forfeit', 'credit']) depositOutOfWindow!: 'forfeit' | 'credit';
  @IsIn([0, 5, 10, 15, 20, 30]) toleranceMin!: number;
}

export class BeneficiosCuentaDto {
  @IsBoolean() accountEnabled!: boolean;
  @IsIn([0, 5, 10, 15, 20]) welcomeDiscountPercent!: number;
  @IsIn([0, 5, 6, 8, 10]) loyaltyStamps!: number;
  @IsBoolean() promosEnabled!: boolean;
}

export class UpdateBookingDto {
  @ValidateNested() @Type(() => ReglasReservaDto) rules!: ReglasReservaDto;
  @ValidateNested() @Type(() => PoliticaReservaDto) policy!: PoliticaReservaDto;
  @ValidateNested() @Type(() => BeneficiosCuentaDto) account!: BeneficiosCuentaDto;
}

export class MensajeAutomaticoDto {
  @IsIn(MENSAJE_IDS) id!: (typeof MENSAJE_IDS)[number];
  @IsBoolean() on!: boolean;
  @IsArray() @ArrayUnique() @IsIn(['wa', 'email'], { each: true }) canales!: ('wa' | 'email')[];
  @IsString() @MaxLength(4) cuando!: string;
  @IsString() @Length(1, 600, { message: 'Cada mensaje tiene entre 1 y 600 caracteres.' }) texto!: string;
}

export class UpdateMessagesDto {
  @IsBoolean() wa!: boolean;
  @IsBoolean() email!: boolean;
  @IsString() @MaxLength(40) numero!: string;
  @IsBoolean() firma!: boolean;
  @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => MensajeAutomaticoDto) mensajes!: MensajeAutomaticoDto[];
}

export class UpdatePaymentsDto {
  @IsIn(['deposit', 'total', 'customer_choice']) onlineCharge!: 'deposit' | 'total' | 'customer_choice';
  @IsArray() @ArrayUnique() @IsIn(METODOS_EN_EL_LOCAL, { each: true }) onSiteMethods!: ('CASH' | 'TRANSFER' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'QR')[];
  @IsOptional() @IsString() @MaxLength(40) transferAlias?: string | null;
  @IsOptional() @Matches(/^(\d{22})?$/, { message: 'El CBU tiene 22 dígitos.' }) transferCbu?: string | null;
  @IsOptional() @IsString() @MaxLength(120) transferHolder?: string | null;
  @IsBoolean() showTransferData!: boolean;
}

export class UpdateWhatsappDto {
  @IsOptional() @Matches(/^\d{8,15}$/, { message: 'El número de WhatsApp va solo con dígitos: entre 8 y 15.' }) number?: string | null;
}
