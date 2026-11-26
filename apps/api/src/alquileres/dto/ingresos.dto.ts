import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { MENSAJE_FECHA, RE_FECHA } from '../../reservas/dto/comunes.dto';
import { MAXIMO_BYTES_CSV } from '../dominio/csv-airbnb';

const DEMASIADO_GRANDE = 'El archivo es demasiado grande. Descargalo por año.';

/** El archivo de ganancias, como texto: el navegador lo abre y lo manda entero. */
export class VistaPreviaCsvDto {
  @IsString({ message: 'Elegí el archivo de ganancias de Airbnb.' })
  @MinLength(1, { message: 'El archivo está vacío.' })
  @MaxLength(MAXIMO_BYTES_CSV, { message: DEMASIADO_GRANDE })
  texto!: string;
}

/** A qué propiedad corresponde un aviso del archivo; `null` es "no importarlo". */
export class AvisoDto {
  @IsString() @MinLength(1) @MaxLength(200)
  nombre!: string;

  @ValidateIf((a: AvisoDto) => a.recursoId !== null)
  @IsUUID('4', { message: 'Elegí una propiedad para cada aviso.' })
  recursoId!: string | null;
}

export class ImportarCsvDto extends VistaPreviaCsvDto {
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => AvisoDto)
  avisos!: AvisoDto[];
}

/** El rango de días (los dos incluidos). */
export class IngresosQueryDto {
  @Matches(RE_FECHA, { message: MENSAJE_FECHA })
  desde!: string;

  @Matches(RE_FECHA, { message: MENSAJE_FECHA })
  hasta!: string;
}
