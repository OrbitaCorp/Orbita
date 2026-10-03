import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsUUID, Max, Min, ValidateIf } from 'class-validator';
import type { FuncionAvanzada } from '../../../appointments.types';

// `config` de cada función de Avanzado (ConfigAvanzado en
// appointments.types.ts). Todo opcional: lo que no viene queda como estaba
// guardado (o como viene de fábrica).

export class PutAdvancedDto {
  @IsBoolean()
  on!: boolean;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class ConfigPaquetesDto {
  @IsOptional() @IsBoolean() compartir?: boolean;
  @IsOptional() @IsBoolean() avisoUltimas?: boolean;
  @IsOptional() @IsBoolean() avisoVence?: boolean;
}

export class ConfigMembresiasDto {
  @IsOptional() @IsBoolean() renueva?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(28) diaCobro?: number;
  @IsOptional() @IsBoolean() pausa?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(90) diasPausa?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10_000_000) matricula?: number;
}

export class ConfigGiftCardsDto {
  @IsOptional() @IsBoolean() montoLibre?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(12) @ArrayUnique() @IsNumber({ maxDecimalPlaces: 2 }, { each: true }) @Min(1_000, { each: true }) @Max(10_000_000, { each: true }) montos?: number[];
  @IsOptional() @IsInt() @Min(0) @Max(36) mesesValidez?: number;
  @IsOptional() @IsBoolean() saldoAFavor?: boolean;
}

export class ConfigFidelidadDto {
  @IsOptional() @IsInt() @Min(3) @Max(20) sellos?: number;
  @IsOptional() @IsIn(['gratis', 'descuento']) premio?: 'gratis' | 'descuento';
  @IsOptional() @ValidateIf((_o, v) => v !== null) @IsUUID('4') serviceId?: string | null;
  @IsOptional() @IsInt() @Min(5) @Max(100) pct?: number;
  @IsOptional() @IsIn(['todos', 'desde']) suma?: 'todos' | 'desde';
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10_000_000) minimo?: number;
  @IsOptional() @IsIn(['rubro', 'estrella', 'corazon', 'sello']) icono?: 'rubro' | 'estrella' | 'corazon' | 'sello';
  @IsOptional() @IsInt() @Min(0) @Max(36) vencenMeses?: number;
  @IsOptional() @IsBoolean() selloDeBienvenida?: boolean;
}

export class ConfigTurnoFijoDto {
  @IsOptional() @IsArray() @ArrayMinSize(1, { message: 'Dejá al menos una frecuencia.' }) @ArrayUnique() @IsIn(['WEEKLY', 'BIWEEKLY', 'MONTHLY'], { each: true }) frecuencias?: ('WEEKLY' | 'BIWEEKLY' | 'MONTHLY')[];
  @IsOptional() @IsInt() @Min(0) @Max(52) maximo?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @ArrayUnique() @IsUUID('4', { each: true }) serviceIds?: string[];
  @IsOptional() @IsIn(['cada', 'mes']) cobro?: 'cada' | 'mes';
  @IsOptional() @IsInt() @Min(0) @Max(10) liberarAusencias?: number;
  @IsOptional() @IsBoolean() saltearFeriados?: boolean;
}

export class ConfigPreciosHorarioDto {
  @IsOptional() @IsBoolean() mostrarTachado?: boolean;
}

/** Las funciones sin config propia: solo se prenden y se apagan. */
export class ConfigVaciaDto {}

export const DTO_DE_CONFIG: Record<FuncionAvanzada, new () => object> = {
  paquetes: ConfigPaquetesDto,
  membresias: ConfigMembresiasDto,
  'gift-cards': ConfigGiftCardsDto,
  fidelidad: ConfigFidelidadDto,
  'turno-fijo': ConfigTurnoFijoDto,
  'precios-horario': ConfigPreciosHorarioDto,
  recuperar: ConfigVaciaDto,
  plantillas: ConfigVaciaDto,
};
