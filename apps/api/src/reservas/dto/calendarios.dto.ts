import { ReservaModulo } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { MENSAJE_MODULO, recortar, recortarObligatorio } from './comunes.dto';

// Conectar el calendario .ics de un aviso (hoy, solo Airbnb) a un recurso.
// Que el enlace sea de Airbnb y termine en .ics lo valida el service
// (calendarios/descarga.ts, errorDeUrl), que arma el mensaje con qué pegar.
export class ConectarCalendarioDto {
  @IsEnum(ReservaModulo, { message: MENSAJE_MODULO })
  modulo!: ReservaModulo;

  @IsUUID('4', { message: 'Elegí a qué propiedad conectarlo.' })
  recursoId!: string;

  /** Cómo lo llama el dueño ("Airbnb", "Airbnb depto 2"). Sin nombre queda "Airbnb". */
  @Transform(recortar) @IsOptional() @IsString() @MaxLength(80)
  nombre?: string;

  @Transform(recortarObligatorio) @IsString({ message: 'Pegá el enlace del calendario.' }) @MaxLength(600, { message: 'Ese enlace es demasiado largo: copialo de nuevo desde Airbnb.' })
  url!: string;
}
