import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ESTADOS } from '../prospeccion.service';
import { MAX_CUENTAS_POR_LOTE } from '../prospeccion.meta';

export class ConsultarCuentasDto {
  /** @usuario, usuario o la URL del perfil de Instagram. */
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(MAX_CUENTAS_POR_LOTE) @IsString({ each: true }) @MaxLength(200, { each: true }) usuarios!: string[];
}

export class ActualizarProspectoDto {
  @IsOptional() @IsIn(ESTADOS as unknown as string[]) estado?: string;
  @IsOptional() @IsString() @MaxLength(2000) notas?: string;
  @IsOptional() @IsUUID() responsableId?: string;
}

export class GuardarAnalisisDto {
  /** Cada elemento lo valida el servicio (cuenta del lote, nivel, confianza, largo del mensaje). */
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) analisis!: unknown[];
}
