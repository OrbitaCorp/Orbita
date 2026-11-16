import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

// Filtros de la lista de contactos de negocios (rol MARKETING, ver contactos-negocios.ts). A propósito NO acepta los
// filtros de la lista completa (estado, suscripción, modo): filtrar por suscripción ya diría cuál paga y cuál no.
export class ListBusinessContactsQueryDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
