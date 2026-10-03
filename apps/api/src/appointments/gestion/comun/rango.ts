import { BadRequestException } from '@nestjs/common';
import { IsOptional, Matches } from 'class-validator';
import { diasEntre, esFecha } from '../../horarios/horarios';

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** `?from&to` de los listados por fechas (días de Argentina). */
export class RangoQueryDto {
  @IsOptional() @Matches(RE_FECHA, { message: 'from tiene que ser una fecha AAAA-MM-DD' }) from?: string;
  @IsOptional() @Matches(RE_FECHA, { message: 'to tiene que ser una fecha AAAA-MM-DD' }) to?: string;
}

/** Valida una fecha suelta (la ruta trae `:date`). */
export function exigirFecha(fecha: string): string {
  if (!esFecha(fecha)) throw new BadRequestException('La fecha no es válida.');
  return fecha;
}

/**
 * Valida un rango de días y lo devuelve completo (por defecto, `porDefecto`).
 * `maxDias` cuenta los días del rango, inclusive.
 */
export function exigirRango(from: string | undefined, to: string | undefined, maxDias: number, porDefecto: { from: string; to: string }): { from: string; to: string } {
  const desde = from ?? porDefecto.from;
  const hasta = to ?? porDefecto.to;
  if (!esFecha(desde) || !esFecha(hasta)) throw new BadRequestException('La fecha no es válida.');
  const dias = diasEntre(desde, hasta) + 1;
  if (dias < 1) throw new BadRequestException('La fecha final tiene que ser igual o posterior a la inicial.');
  if (dias > maxDias) throw new BadRequestException(`El rango puede tener hasta ${maxDias} días.`);
  return { from: desde, to: hasta };
}
