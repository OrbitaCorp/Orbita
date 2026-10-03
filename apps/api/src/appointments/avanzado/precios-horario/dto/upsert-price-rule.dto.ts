import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsInt, IsOptional, Max, Min, NotEquals } from 'class-validator';

// Una franja de "Precios por horario" (CONTRATO § P4.4).
export class UpsertPriceRuleDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Elegí al menos un día.' })
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays!: number[];

  @IsInt()
  @Min(0)
  @Max(1440)
  fromMin!: number;

  @IsInt()
  @Min(0)
  @Max(1440)
  toMin!: number;

  @IsInt()
  @Min(-90)
  @Max(100)
  @NotEquals(0, { message: 'El ajuste no puede ser 0 %.' })
  adjustPercent!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
