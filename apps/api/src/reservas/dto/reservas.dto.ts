import { ReservaEstado, ReservaModulo } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min,
  ValidateNested,
} from 'class-validator';
import { ClienteDto, MENSAJE_FECHA, MENSAJE_MODULO, PaginacionDto, RE_FECHA, recortar } from './comunes.dto';

// Qué se quiere reservar: el recurso, el día y la hora (minutos de Argentina),
// y según el tipo: el servicio (Turnos), cuántas franjas seguidas (canchas),
// hasta qué día (alojamientos) o cuántos lugares (clases).
export class PedidoReservaDto {
  @IsEnum(ReservaModulo, { message: MENSAJE_MODULO })
  modulo!: ReservaModulo;

  @IsUUID('4', { message: 'Elegí qué querés reservar.' })
  recursoId!: string;

  @IsOptional() @IsUUID('4')
  servicioId?: string;

  @Matches(RE_FECHA, { message: MENSAJE_FECHA })
  fecha!: string;

  /** Minutos desde las 00:00 de Argentina. Un alojamiento lo ignora (usa su hora de check-in). */
  @IsOptional() @IsInt() @Min(0) @Max(1439)
  inicioMinutos?: number;

  /** Canchas y salones: minutos totales (múltiplo de la duración del recurso). Sin esto, una franja. */
  @IsOptional() @IsInt() @Min(5) @Max(1440)
  duracionMinutos?: number;

  /** Alojamientos: día del check-out. */
  @IsOptional() @Matches(RE_FECHA, { message: MENSAJE_FECHA })
  fechaHasta?: string;

  /** Lugares que ocupa (clases). */
  @IsOptional() @IsInt() @Min(1) @Max(50)
  cantidad?: number;

  /** Ids de los extras del recurso. */
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(60, { each: true })
  extras?: string[];

  @Transform(recortar) @IsOptional() @IsString() @MaxLength(500)
  notas?: string;
}

/** Sitio público, paso 1: tomar el lugar mientras la persona carga sus datos. */
export class RetenerDto extends PedidoReservaDto {
  /** Un uuid por intento. Repetir el pedido con la misma clave devuelve la misma reserva (doble clic, reintento). */
  @IsUUID('4', { message: 'Falta la clave del intento (un uuid).' })
  clave!: string;
}

/** Sitio público, paso 2: confirmar la retenida con los datos de contacto. */
export class ConfirmarRetenidaDto {
  @ValidateNested() @Type(() => ClienteDto)
  cliente!: ClienteDto;

  @Transform(recortar) @IsOptional() @IsString() @MaxLength(500)
  notas?: string;
}

/** Sitio público, en un paso: reservar con los datos ya cargados. */
export class ReservarDto extends RetenerDto {
  @ValidateNested() @Type(() => ClienteDto)
  cliente!: ClienteDto;
}

/** Panel: el negocio carga una reserva (nace confirmada). */
export class CrearReservaPanelDto extends PedidoReservaDto {
  @IsOptional() @ValidateNested() @Type(() => ClienteDto)
  cliente?: ClienteDto;

  /** Una ficha de cliente que ya existe (en vez de cargar los datos). */
  @IsOptional() @IsUUID('4')
  clienteId?: string;

  @Transform(recortar) @IsOptional() @IsString() @MaxLength(500)
  notaInterna?: string;

  /** Precio a mano (exige reservas.config): un arreglo, un descuento puntual. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100_000_000)
  precio?: number;

  /** Nace PENDIENTE en vez de CONFIRMADA (a confirmar con el cliente). */
  @IsOptional() @IsIn(['CONFIRMADA', 'PENDIENTE'])
  estado?: 'CONFIRMADA' | 'PENDIENTE';

  /** Permite un horario fuera de la apertura (un turno excepcional). Nunca saltea el cupo ni los bloqueos. */
  @IsOptional() @IsBoolean()
  fueraDeHorario?: boolean;

  /** Un uuid por intento, como en el sitio: dos clics no crean dos reservas. */
  @IsOptional() @IsUUID('4')
  clave?: string;
}

export class CancelarDto {
  @Transform(recortar) @IsOptional() @IsString() @MaxLength(300)
  motivo?: string;

  /** Panel: la seña paga no se devuelve (por defecto, si cancela el negocio, se devuelve). */
  @IsOptional() @IsBoolean()
  mantenerSena?: boolean;

  /** Si viene y no coincide con la versión actual, 409: alguien la cambió antes. */
  @IsOptional() @IsInt() @Min(1)
  version?: number;
}

export class ReprogramarDto {
  @Matches(RE_FECHA, { message: MENSAJE_FECHA })
  fecha!: string;

  @IsOptional() @IsInt() @Min(0) @Max(1439)
  inicioMinutos?: number;

  @IsOptional() @Matches(RE_FECHA, { message: MENSAJE_FECHA })
  fechaHasta?: string;

  /** Cambiar de agenda, cancha o clase (mismo módulo y tipo).  */
  @IsOptional() @IsUUID('4')
  recursoId?: string;

  @IsOptional() @IsBoolean()
  fueraDeHorario?: boolean;

  @IsOptional() @IsInt() @Min(1)
  version?: number;
}

export class CambioDeEstadoDto {
  @Transform(recortar) @IsOptional() @IsString() @MaxLength(300)
  motivo?: string;

  @IsOptional() @IsInt() @Min(1)
  version?: number;
}

export const METODOS_DE_PAGO = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MERCADOPAGO', 'OTRO'] as const;

export class RegistrarPagoDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01, { message: 'El monto tiene que ser mayor a 0.' }) @Max(100_000_000)
  monto!: number;

  @IsIn(METODOS_DE_PAGO, { message: 'El método tiene que ser EFECTIVO, TRANSFERENCIA, TARJETA, MERCADOPAGO u OTRO.' })
  metodo!: (typeof METODOS_DE_PAGO)[number];

  @Transform(recortar) @IsOptional() @IsString() @MaxLength(120)
  referencia?: string;
}

export class NotaInternaDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional() @IsString() @MaxLength(500)
  notaInterna?: string | null;
}

export class ListarReservasQueryDto extends PaginacionDto {
  @IsOptional() @IsEnum(ReservaModulo, { message: MENSAJE_MODULO })
  modulo?: ReservaModulo;

  @IsOptional() @Matches(RE_FECHA, { message: MENSAJE_FECHA })
  desde?: string;

  @IsOptional() @Matches(RE_FECHA, { message: MENSAJE_FECHA })
  hasta?: string;

  @IsOptional() @IsUUID('4')
  recursoId?: string;

  @IsOptional() @IsUUID('4')
  clienteId?: string;

  /** Lista separada por comas: CONFIRMADA,PENDIENTE */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : value))
  @IsArray() @IsEnum(ReservaEstado, { each: true })
  estado?: ReservaEstado[];

  @Transform(recortar) @IsOptional() @IsString() @MaxLength(120)
  q?: string;
}

export class DisponibilidadQueryDto {
  @IsEnum(ReservaModulo, { message: MENSAJE_MODULO })
  modulo!: ReservaModulo;

  @IsUUID('4')
  recursoId!: string;

  @Matches(RE_FECHA, { message: MENSAJE_FECHA })
  fecha!: string;

  @IsOptional() @IsUUID('4')
  servicioId?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(1440)
  duracionMinutos?: number;

  /** Panel: la reserva que se está moviendo no cuenta como ocupada. */
  @IsOptional() @IsUUID('4')
  salvo?: string;
}

export class DisponibilidadRangoQueryDto {
  @IsEnum(ReservaModulo, { message: MENSAJE_MODULO })
  modulo!: ReservaModulo;

  @IsUUID('4')
  recursoId!: string;

  @Matches(RE_FECHA, { message: MENSAJE_FECHA })
  desde!: string;

  @Matches(RE_FECHA, { message: MENSAJE_FECHA })
  hasta!: string;

  @IsOptional() @IsUUID('4')
  servicioId?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(1440)
  duracionMinutos?: number;
}

export class AnotarseEnEsperaDto {
  @IsEnum(ReservaModulo, { message: MENSAJE_MODULO })
  modulo!: ReservaModulo;

  @IsUUID('4')
  recursoId!: string;

  @Matches(RE_FECHA, { message: MENSAJE_FECHA })
  fecha!: string;

  @IsInt() @Min(0) @Max(1439)
  inicioMinutos!: number;

  @ValidateNested() @Type(() => ClienteDto)
  cliente!: ClienteDto;
}

export class ListarEsperaQueryDto {
  @IsEnum(ReservaModulo, { message: MENSAJE_MODULO })
  modulo!: ReservaModulo;

  @IsOptional() @IsUUID('4')
  recursoId?: string;

  @IsOptional() @Matches(RE_FECHA, { message: MENSAJE_FECHA })
  fecha?: string;
}

export class ResumenQueryDto {
  @IsEnum(ReservaModulo, { message: MENSAJE_MODULO })
  modulo!: ReservaModulo;

  @Matches(RE_FECHA, { message: MENSAJE_FECHA })
  desde!: string;

  @Matches(RE_FECHA, { message: MENSAJE_FECHA })
  hasta!: string;
}
