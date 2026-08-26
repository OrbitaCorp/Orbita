import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpsertGameDto {
  @IsOptional() @IsString() name?: string;
  @IsBoolean() isActive!: boolean;
  // % de descuento por acierto — el form del panel sugiere 1 como
  // placeholder, pero no hay default fijo acá: lo configura el dueño.
  @IsNumber() @Min(0) @Max(100) percentPerWin!: number;
  // Techo acumulado — validado contra percentPerWin en el service (no acá,
  // necesita comparar los dos campos entre sí).
  @IsNumber() @Min(0) @Max(100) maxPercent!: number;
}
