import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Endpoint público y sin auth: todo viene con tope. Los largos chicos no son
// caprichosos — son la garantía de que por acá no se cuela texto libre del
// usuario. Ver también sanitizarMeta() en el servicio.

export class WizardEventDto {
  @IsString() @MaxLength(40) type!: string;

  @IsOptional() @IsInt() @Min(0) @Max(10) step?: number;

  @IsOptional() @IsString() @MaxLength(40) stepName?: string;

  @IsOptional() @IsString() @MaxLength(40) field?: string;

  @IsOptional() @IsString() @MaxLength(40) rubro?: string;

  // Tope de una hora: más que eso es una pestaña olvidada, no un dato.
  @IsOptional() @IsInt() @Min(0) @Max(3_600_000) durationMs?: number;

  @IsOptional() @IsObject() meta?: Record<string, unknown>;

  @IsOptional() @IsInt() @Min(0) offset?: number; // ms desde el evento anterior del lote
}

export class IngestEventsDto {
  /** Una visita al wizard. Lo genera el cliente (crypto.randomUUID). */
  @IsString() @Length(8, 64) sessionId!: string;

  /** El navegador — sobrevive recargas y visitas separadas. */
  @IsString() @Length(8, 64) anonId!: string;

  @IsOptional() @IsIn(['mobile', 'desktop']) device?: 'mobile' | 'desktop';

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => WizardEventDto)
  events!: WizardEventDto[];
}

export class RateAiTurnDto {
  @IsString() @Length(8, 64) turnId!: string;

  /** Pulgar arriba (1) o abajo (-1). */
  @IsIn([1, -1]) rating!: number;
}
