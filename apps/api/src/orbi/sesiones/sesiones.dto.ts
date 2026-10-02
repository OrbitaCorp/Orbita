import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { LARGO_MAXIMO_DEL_TITULO } from './titulo';

export class ListarSesionesDto {
  /** 1 = solo las archivadas. */
  @IsOptional() @IsIn(['0', '1'])
  archivadas?: string;

  @IsOptional() @IsString() @MaxLength(80)
  q?: string;

  @IsOptional() @IsString() @MaxLength(80)
  cursor?: string;
}

export class CrearSesionDto {
  /** La pantalla desde donde se abrió (la `section` del chat). */
  @IsOptional() @IsString() @MaxLength(60)
  pantalla?: string;
}

export class EditarSesionDto {
  // Una sola línea: los saltos y controles se rechazan (los de formato, como
  // los bidi, se limpian en el service). Vacío = volver al título automático.
  @IsOptional() @IsString() @MaxLength(LARGO_MAXIMO_DEL_TITULO)
  @Matches(/^[^\p{Cc}\p{Zl}\p{Zp}]*$/u, { message: 'titulo: tiene que ser una sola línea' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  titulo?: string;

  @IsOptional() @IsBoolean()
  fijada?: boolean;

  @IsOptional() @IsBoolean()
  archivada?: boolean;
}
