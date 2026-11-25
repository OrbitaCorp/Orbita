import { GimnasioPlanTipo } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested,
} from 'class-validator';
import { ClienteDto, MENSAJE_FECHA, RE_FECHA, recortar, recortarObligatorio } from '../../reservas/dto/comunes.dto';
import { PAGOS, type Pago } from '../dominio/planes';

const MENSAJE_TIPO = 'El tipo de plan tiene que ser PRUEBA, SUELTA, PACK o MEMBRESIA.';
const MENSAJE_PAGO = 'Decí cómo se paga el lugar: plan, aparte o prueba.';

/** El rango de días de la grilla del sitio (los dos incluidos). */
export class GrillaQueryDto {
  @Matches(RE_FECHA, { message: MENSAJE_FECHA })
  desde!: string;

  @Matches(RE_FECHA, { message: MENSAJE_FECHA })
  hasta!: string;
}

/** Un plan como lo edita Planes y precios. Con `id`, uno que ya existe; sin `id`, uno nuevo. */
export class PlanDto {
  @IsOptional() @IsUUID('4')
  id?: string;

  @IsEnum(GimnasioPlanTipo, { message: MENSAJE_TIPO })
  tipo!: GimnasioPlanTipo;

  @Transform(recortarObligatorio)
  @IsString() @MinLength(2, { message: 'Ponele un nombre al plan.' }) @MaxLength(80)
  nombre!: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio tiene que ser un número.' }) @Min(0) @Max(100_000_000)
  precio!: number;

  /** Pack: cuántas clases trae. */
  @ValidateIf((p: PlanDto) => p.tipo === 'PACK' || (p.clases !== undefined && p.clases !== null))
  @IsInt({ message: 'Un pack tiene que decir cuántas clases trae.' }) @Min(1) @Max(500)
  clases?: number | null;

  /** Membresía: clases por semana; 0 = libre. */
  @ValidateIf((p: PlanDto) => p.porSemana !== undefined && p.porSemana !== null)
  @IsInt() @Min(0) @Max(21)
  porSemana?: number | null;

  @IsInt({ message: 'Decí cuántos días vale el plan.' }) @Min(1) @Max(730)
  vigenciaDias!: number;

  @IsBoolean()
  activo!: boolean;
}

/** La lista entera de planes, como queda después de guardar: lo que no viene se quita. */
export class GuardarPlanesDto {
  @IsArray() @ArrayMaxSize(30, { message: 'Como mucho 30 planes.' }) @ValidateNested({ each: true }) @Type(() => PlanDto)
  planes!: PlanDto[];
}

/** Dar de alta a un alumno: una ficha de cliente que ya existe, o sus datos (nombre y un celular o un email). */
export class AltaAlumnoDto {
  @IsOptional() @IsUUID('4')
  clienteId?: string;

  @IsOptional() @ValidateNested() @Type(() => ClienteDto)
  cliente?: ClienteDto;

  @Transform(recortar) @IsOptional() @IsString() @MaxLength(500)
  nota?: string;

  /** El plan con el que arranca (un pack o una membresía). */
  @IsOptional() @IsUUID('4')
  planId?: string;
}

export class CambiarAlumnoDto {
  /** Vacía, la borra. */
  @IsOptional() @IsString() @MaxLength(500)
  nota?: string;
}

export class AsignarPlanDto {
  @IsUUID('4', { message: 'Elegí un plan.' })
  planId!: string;
}

/** Anotar a alguien en una clase desde el panel, diciendo cómo se paga el lugar. */
export class ReservarConPlanDto {
  @IsUUID('4', { message: 'Elegí la clase.' })
  recursoId!: string;

  @Matches(RE_FECHA, { message: MENSAJE_FECHA })
  fecha!: string;

  @IsInt() @Min(0) @Max(1439)
  inicioMinutos!: number;

  @IsOptional() @IsInt() @Min(1) @Max(50)
  cantidad?: number;

  /** Quién: un alumno, una ficha de cliente o los datos de alguien nuevo. */
  @IsOptional() @IsUUID('4')
  alumnoId?: string;

  @IsOptional() @IsUUID('4')
  clienteId?: string;

  @IsOptional() @ValidateNested() @Type(() => ClienteDto)
  cliente?: ClienteDto;

  @IsIn([...PAGOS], { message: MENSAJE_PAGO })
  pago!: Pago;

  /** Un uuid por intento: repetir el pedido devuelve la misma reserva y no descuenta dos veces. */
  @IsUUID('4', { message: 'Falta la clave del intento.' })
  clave!: string;
}

/** Decir (o corregir) cómo se paga un lugar que ya está reservado: el de quien pasó de la lista de espera o reservó desde el sitio. */
export class DefinirPagoDto {
  @IsIn([...PAGOS], { message: MENSAJE_PAGO })
  pago!: Pago;
}
