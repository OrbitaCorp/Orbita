import { ReservaModulo } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateBy, type ValidationOptions } from 'class-validator';

export const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
export const MENSAJE_FECHA = 'La fecha tiene que ser AAAA-MM-DD.';
export const MENSAJE_MODULO = 'El módulo tiene que ser TURNOS, ALQUILERES o GIMNASIO.';

/**
 * Un objeto JSON libre (el `datos` de una reserva o de la config) que no pase
 * de `maximo` caracteres serializado. El motor no mira adentro, pero uno de
 * estos llega desde el sitio público: sin tope sería un lugar donde guardar
 * cualquier cosa.
 */
export function JsonHasta(maximo: number, opciones?: ValidationOptions): PropertyDecorator {
  return ValidateBy({
    name: 'jsonHasta',
    constraints: [maximo],
    validator: {
      validate: (v: unknown) => {
        if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
        try { return JSON.stringify(v).length <= maximo; } catch { return false; }
      },
      defaultMessage: () => `Los datos tienen que ser un objeto de hasta ${maximo} caracteres.`,
    },
  }, opciones);
}

/** Tope del `datos` de una reserva (llega también desde el sitio) y del de la config (solo desde el panel). */
export const MAX_DATOS_RESERVA = 2_000;
export const MAX_DATOS_CONFIG = 20_000;

/** Recorta espacios; un texto vacío queda undefined para que lo opcional sea opcional de verdad. */
export const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || undefined : value);
/** Lo mismo, pero el vacío queda vacío (campos obligatorios). */
export const recortarObligatorio = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ModuloQueryDto {
  @IsEnum(ReservaModulo, { message: MENSAJE_MODULO })
  modulo!: ReservaModulo;
}

/** Datos de contacto de quien reserva: el nombre es obligatorio y hace falta un teléfono o un email para avisarle. */
export class ClienteDto {
  @Transform(recortarObligatorio)
  @IsString()
  @MinLength(2, { message: 'Decinos tu nombre.' })
  @MaxLength(120)
  nombre!: string;

  @Transform(recortar)
  @IsOptional()
  @IsString()
  @Matches(/^[\d\s()+-]{6,30}$/, { message: 'El teléfono tiene que tener solo números (podés usar espacios, + y guiones).' })
  telefono?: string;

  @Transform(recortar)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'Revisá el email: no parece una dirección válida.' })
  email?: string;
}

export class PaginacionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class IdUuidDto {
  @IsUUID('4')
  id!: string;
}
