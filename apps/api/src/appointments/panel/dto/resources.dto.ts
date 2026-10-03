import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';

// DTOs de Agendas — espacios (CONTRATO.md § P1.3). Las personas son de P3.

export class UpsertSpaceDto {
  @IsString() @Length(1, 120, { message: 'El nombre tiene entre 1 y 120 caracteres.' }) name!: string;
  @IsOptional() @IsString() @MaxLength(80) roleLabel?: string | null;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'El color va en formato #RRGGBB.' }) color?: string | null;
  @IsArray() @ArrayMinSize(1, { message: 'Elegí al menos un día.' }) @ArrayMaxSize(7) @ArrayUnique({ message: 'Hay un día repetido.' })
  @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true })
  workDays!: number[];
  // Semana propia (7 días de tramos) o null = sigue al negocio. La valida errorSemana() en el service.
  @IsOptional() @IsArray() ownSchedule?: unknown[] | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ListResourcesQueryDto {
  @IsOptional() @IsIn(['PERSON', 'SPACE']) kind?: 'PERSON' | 'SPACE';
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() bookable?: boolean;
}
