import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateNested } from 'class-validator';
import { ItemPublicacionDto } from './crear-publicacion.dto';

// Programar una publicación (sale sola a `programarPara`) o guardarla como borrador. Si viene `id`, se actualiza
// ese borrador o programada en vez de crear uno nuevo.
export class ProgramarPublicacionDto {
  @IsOptional() @IsUUID() id?: string;
  @IsOptional() @IsUUID() productId?: string;
  @IsString() @MaxLength(2200) caption!: string;
  @IsIn(['cuadrado', 'vertical']) formato!: 'cuadrado' | 'vertical';
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => ItemPublicacionDto) items!: ItemPublicacionDto[];
  @IsISO8601() programarPara!: string;
}

// Un borrador puede estar a medias: sin fotos todavía.
export class BorradorPublicacionDto {
  @IsOptional() @IsUUID() id?: string;
  @IsOptional() @IsUUID() productId?: string;
  @IsString() @MaxLength(2200) caption!: string;
  @IsIn(['cuadrado', 'vertical']) formato!: 'cuadrado' | 'vertical';
  @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => ItemPublicacionDto) items!: ItemPublicacionDto[];
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

class BienvenidaDto {
  @IsBoolean() activa!: boolean;
  @IsString() @MaxLength(500) texto!: string;
}
class AusenciaDto {
  @IsBoolean() activa!: boolean;
  @IsString() @MaxLength(500) texto!: string;
  @Matches(HORA) desde!: string;
  @Matches(HORA) hasta!: string;
  @IsArray() @ArrayMaxSize(7) @IsIn([0, 1, 2, 3, 4, 5, 6], { each: true }) dias!: number[];
}
class ModeracionDto {
  @IsBoolean() activa!: boolean;
  @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(40, { each: true }) palabras!: string[];
}

// Ajustes de Instagram del negocio: respuestas automáticas y moderación de comentarios.
export class AjustesInstagramDto {
  @ValidateNested() @Type(() => BienvenidaDto) bienvenida!: BienvenidaDto;
  @ValidateNested() @Type(() => AusenciaDto) ausencia!: AusenciaDto;
  @ValidateNested() @Type(() => ModeracionDto) moderacion!: ModeracionDto;
}
