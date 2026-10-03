import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min } from 'class-validator';

// DTOs de Servicios (CONTRATO.md § P1.2).

export class UpsertServiceDto {
  @IsString() @Length(1, 120, { message: 'El nombre del servicio tiene entre 1 y 120 caracteres.' }) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string | null;
  @IsInt() @Min(5, { message: 'Un servicio dura al menos 5 minutos.' }) @Max(600, { message: 'Un servicio dura como máximo 10 horas.' }) durationMin!: number;
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El precio va en pesos, con hasta 2 decimales.' }) @Min(0) @Max(100_000_000) price!: number;
  @IsBoolean() bookableOnline!: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class OrderServicesDto {
  @IsArray() @ArrayMaxSize(200) @ArrayUnique() @IsUUID('4', { each: true }) ids!: string[];
}

export class ListServicesQueryDto {
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() includeInactive?: boolean;
}
