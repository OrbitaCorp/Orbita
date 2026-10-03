import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

// Recuperar clientes (CONTRATO § P4.7).
export const DIAS_INACTIVO = [30, 45, 60, 90, 120] as const;

export class UpsertWinbackDto {
  @IsIn(DIAS_INACTIVO as unknown as number[])
  inactiveDays!: number;

  @IsString()
  @MinLength(1, { message: 'Escribí el mensaje.' })
  @MaxLength(600)
  message!: string;

  @IsBoolean()
  couponEnabled!: boolean;

  @IsInt()
  @Min(5)
  @Max(50)
  couponPercent!: number;

  @IsInt()
  @Min(7)
  @Max(60)
  couponValidDays!: number;

  @IsIn(['auto', 'manual'])
  mode!: 'auto' | 'manual';

  @IsBoolean()
  isActive!: boolean;
}

export class AudienceQuery {
  @Type(() => Number)
  @IsIn(DIAS_INACTIVO as unknown as number[])
  inactiveDays!: number;
}
