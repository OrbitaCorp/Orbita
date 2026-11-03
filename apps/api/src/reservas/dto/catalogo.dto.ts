import { ReservaConfirmacion, ReservaModulo, ReservaRecursoTipo } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsDefined, IsEnum, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID,
  Matches, Max, MaxLength, Min, MinLength, ValidateIf,
} from 'class-validator';
import { MENSAJE_FECHA, MENSAJE_MODULO, RE_FECHA, recortar, recortarObligatorio } from './comunes.dto';

// Las reglas de reserva de un módulo. Los rangos son los que ofrece el panel;
// el horario se valida en el service (errorDeHorario) porque class-validator
// no describe bien "un objeto con listas de pares".
export class UpsertConfigDto {
  @IsEnum(ReservaModulo, { message: MENSAJE_MODULO })
  modulo!: ReservaModulo;

  @IsOptional() @IsBoolean()
  activo?: boolean;

  @IsOptional() @IsEnum(ReservaConfirmacion)
  confirmacion?: ReservaConfirmacion;

  @IsOptional() @IsInt() @Min(1) @Max(120)
  retencionMinutos?: number;

  @IsOptional() @IsInt() @Min(0) @Max(10_080)
  anticipacionMinimaMinutos?: number;

  @IsOptional() @IsInt() @Min(1) @Max(365)
  anticipacionMaximaDias?: number;

  @IsOptional() @IsInt() @Min(0) @Max(720)
  cancelacionHastaHoras?: number;

  @IsOptional() @IsInt() @Min(0) @Max(720)
  reprogramacionHastaHoras?: number;

  @IsOptional() @IsInt() @Min(0) @Max(10)
  reprogramacionesMaximas?: number;

  @IsOptional() @IsInt() @Min(0) @Max(100)
  senaPorcentaje?: number;

  @IsOptional() @IsBoolean()
  senaReembolsable?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(50)
  maximoActivasPorCliente?: number;

  @IsOptional() @IsBoolean()
  listaDeEspera?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(240)
  margenMinutos?: number;

  /** Obligatorio al crear; al editar, si no viene, queda el de antes. */
  @IsOptional() @IsObject({ message: 'El horario tiene que ser un objeto con los días de la semana.' })
  horario?: Record<string, unknown>;
}

export class UpsertRecursoDto {
  @IsEnum(ReservaModulo, { message: MENSAJE_MODULO })
  modulo!: ReservaModulo;

  @IsEnum(ReservaRecursoTipo, { message: 'El tipo tiene que ser PROFESIONAL, ESPACIO, CANCHA, SALON, ALOJAMIENTO o CLASE.' })
  tipo!: ReservaRecursoTipo;

  @Transform(recortarObligatorio) @IsString() @MinLength(1, { message: 'El nombre es obligatorio.' }) @MaxLength(120)
  nombre!: string;

  @Transform(recortar) @IsOptional() @IsString() @MaxLength(500)
  descripcion?: string;

  @IsOptional() @IsInt() @Min(1) @Max(1000)
  cupo?: number;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(5) @Max(1440)
  duracionMinutos?: number | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(5) @Max(1440)
  pasoMinutos?: number | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(240)
  margenMinutos?: number | null;

  @IsOptional() @IsInt() @Min(1) @Max(24)
  maximoSeguidos?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100_000_000)
  precio?: number;

  /** null = usa el horario de la config. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsObject()
  horario?: Record<string, unknown> | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsObject()
  datos?: Record<string, unknown> | null;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsUUID('4')
  memberId?: string | null;

  @IsOptional() @IsInt() @Min(0) @Max(10_000)
  orden?: number;

  @IsOptional() @IsBoolean()
  activo?: boolean;
}

export class UpsertServicioDto {
  @IsEnum(ReservaModulo, { message: MENSAJE_MODULO })
  modulo!: ReservaModulo;

  @Transform(recortarObligatorio) @IsString() @MinLength(1, { message: 'El nombre es obligatorio.' }) @MaxLength(120)
  nombre!: string;

  @Transform(recortar) @IsOptional() @IsString() @MaxLength(500)
  descripcion?: string;

  @IsDefined({ message: 'La duración es obligatoria.' }) @IsInt() @Min(5) @Max(1440)
  duracionMinutos!: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100_000_000)
  precio?: number;

  @IsOptional() @IsBoolean()
  reservableOnline?: boolean;

  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('4', { each: true })
  recursoIds?: string[];

  @IsOptional() @IsInt() @Min(0) @Max(10_000)
  orden?: number;

  @IsOptional() @IsBoolean()
  activo?: boolean;
}

export class CrearBloqueoDto {
  @IsEnum(ReservaModulo, { message: MENSAJE_MODULO })
  modulo!: ReservaModulo;

  /** Sin recurso tapa a todos los del módulo. */
  @IsOptional() @IsUUID('4')
  recursoId?: string;

  @Matches(RE_FECHA, { message: MENSAJE_FECHA })
  fechaDesde!: string;

  @IsOptional() @IsInt() @Min(0) @Max(1440)
  minutoDesde?: number;

  @IsOptional() @Matches(RE_FECHA, { message: MENSAJE_FECHA })
  fechaHasta?: string;

  @IsOptional() @IsInt() @Min(0) @Max(1440)
  minutoHasta?: number;

  @Transform(recortar) @IsOptional() @IsString() @MaxLength(200)
  motivo?: string;
}

export class ListarBloqueosQueryDto {
  @IsEnum(ReservaModulo, { message: MENSAJE_MODULO })
  modulo!: ReservaModulo;

  @IsOptional() @Matches(RE_FECHA, { message: MENSAJE_FECHA })
  desde?: string;

  @IsOptional() @Matches(RE_FECHA, { message: MENSAJE_FECHA })
  hasta?: string;
}

export class ListarCatalogoQueryDto {
  @IsEnum(ReservaModulo, { message: MENSAJE_MODULO })
  modulo!: ReservaModulo;

  @IsOptional() @Type(() => String) @IsString()
  inactivos?: string;
}
