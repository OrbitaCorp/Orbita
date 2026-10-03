import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class PaginaQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

/** POST appointments/earnings/:resourceId/payouts */
export class RegisterPayoutDto {
  /** Hasta qué día (inclusive) se paga. Por defecto, hoy. */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'periodTo tiene que ser una fecha AAAA-MM-DD' }) periodTo?: string;
  /** Por defecto, lo que da la liquidación pendiente hasta `periodTo`. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(100_000_000) amount?: number;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}
