import { IsString, MaxLength } from 'class-validator';

// Ítem de la barra de estadísticas decorativa debajo del slider del hero
// (ej: "+1.200 ventas realizadas"). Texto libre, no calculado — el dueño
// escribe lo que quiere mostrar.
export class StatsBarItemDto {
  @IsString() @MaxLength(64) id!: string;
  @IsString() @MaxLength(30) value!: string;
  @IsString() @MaxLength(80) label!: string;
}
