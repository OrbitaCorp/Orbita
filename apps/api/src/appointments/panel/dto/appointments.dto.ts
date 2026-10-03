import { Type } from 'class-transformer';
import {
  IsBoolean, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested,
} from 'class-validator';
import { MENSAJE_IDS } from '../lib/mensajes';

// DTOs de Turnos y Agenda (CONTRATO.md § P1.4 y P1.5).

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MSJ_FECHA = { message: 'Las fechas van como AAAA-MM-DD.' };
/** Una agenda puntual (uuid) o "cualquiera". */
const AGENDA = /^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|cualquiera)$/i;
const MSJ_AGENDA = { message: 'La agenda tiene que ser un id o "cualquiera".' };

export class ListAppointmentsQueryDto {
  @IsOptional() @Matches(FECHA, MSJ_FECHA) from?: string;
  @IsOptional() @Matches(FECHA, MSJ_FECHA) to?: string;
  @IsOptional() @IsUUID('4') resourceId?: string;
  @IsOptional() @IsUUID('4') customerId?: string;
  /** Lista separada por comas: PENDING,CONFIRMED… */
  @IsOptional() @IsString() @MaxLength(80) status?: string;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class AvailabilityQueryDto {
  @IsUUID('4') serviceId!: string;
  @Matches(FECHA, MSJ_FECHA) date!: string;
  @IsOptional() @Matches(AGENDA, MSJ_AGENDA) resourceId?: string;
  /** Id del turno que se está moviendo: no cuenta como ocupado. */
  @IsOptional() @IsUUID('4') except?: string;
}

export class AvailabilityRangeQueryDto {
  @IsUUID('4') serviceId!: string;
  @Matches(FECHA, MSJ_FECHA) from!: string;
  @Matches(FECHA, MSJ_FECHA) to!: string;
  @IsOptional() @Matches(AGENDA, MSJ_AGENDA) resourceId?: string;
  @IsOptional() @IsUUID('4') except?: string;
}

export class ClienteNuevoDto {
  @IsString() @Length(3, 120, { message: 'El nombre del cliente tiene entre 3 y 120 caracteres.' }) name!: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsEmail({}, { message: 'El email no es válido.' }) @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(120) insuranceName?: string;
}

export class CreateAppointmentDto {
  @IsUUID('4') serviceId!: string;
  @Matches(AGENDA, MSJ_AGENDA) resourceId!: string;
  @Matches(FECHA, MSJ_FECHA) date!: string;
  @IsInt() @Min(0) @Max(1439) startMin!: number;
  @IsOptional() @IsUUID('4') customerId?: string;
  @IsOptional() @ValidateNested() @Type(() => ClienteNuevoDto) customer?: ClienteNuevoDto;
  @IsOptional() @IsIn(['ON_SITE', 'HOME']) modality?: 'ON_SITE' | 'HOME';
  @IsOptional() @IsString() @MaxLength(500) internalNote?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100_000_000) priceOverride?: number;
}

export class ChangeStatusDto {
  @IsIn(['CONFIRMED', 'COMPLETED', 'NO_SHOW', 'CANCELLED']) status!: 'CONFIRMED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
  /** Al cancelar con seña paga: el negocio se la queda (por defecto se devuelve). */
  @IsOptional() @IsBoolean() keepDeposit?: boolean;
}

export class MoveAppointmentDto {
  @Matches(FECHA, MSJ_FECHA) date!: string;
  @IsInt() @Min(0) @Max(1439) startMin!: number;
  @IsOptional() @Matches(AGENDA, MSJ_AGENDA) resourceId?: string;
}

export class RegisterDepositDto {
  @IsIn(['CASH', 'TRANSFER', 'DEBIT_CARD', 'CREDIT_CARD', 'QR']) method!: 'CASH' | 'TRANSFER' | 'DEBIT_CARD' | 'CREDIT_CARD' | 'QR';
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(100_000_000) amount?: number;
  @IsOptional() @IsIn(['DEPOSIT', 'BALANCE', 'FULL']) kind?: 'DEPOSIT' | 'BALANCE' | 'FULL';
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
}

export class NoteDto {
  // Obligatorio: string (≤500) o null para borrarla.
  @ValidateIf((o: NoteDto) => o.internalNote !== null) @IsString() @MaxLength(500) internalNote!: string | null;
}

export class MessageTemplateDto {
  @IsIn(MENSAJE_IDS, { message: `La plantilla tiene que ser una de: ${MENSAJE_IDS.join(', ')}.` }) template!: (typeof MENSAJE_IDS)[number];
}

export class DayQueryDto {
  @IsOptional() @Matches(FECHA, MSJ_FECHA) date?: string;
}

export class RangeQueryDto {
  @Matches(FECHA, MSJ_FECHA) from!: string;
  @Matches(FECHA, MSJ_FECHA) to!: string;
}
