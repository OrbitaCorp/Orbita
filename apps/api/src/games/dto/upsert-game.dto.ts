import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpsertGameDto {
  @IsOptional() @IsString() name?: string;
  @IsBoolean() isActive!: boolean;
  // % de descuento por acierto — el form del panel sugiere 1 como
  // placeholder, pero no hay default fijo acá: lo configura el dueño.
  @IsNumber() @Min(0) @Max(100) percentPerWin!: number;
  // Techo acumulado — validado contra percentPerWin en el service (no acá,
  // necesita comparar los dos campos entre sí).
  @IsNumber() @Min(0) @Max(100) maxPercent!: number;
  // Segundos por tiro antes de que cuente como fallo — entero, 1 a 30 (menos
  // de 1s es injugable, más de 30s deja de sentirse como un juego de
  // timing). Opcional: si no se manda, el service usa el default de 4.
  @IsOptional() @IsInt() @Min(1) @Max(30) timeLimitSeconds?: number;
}
