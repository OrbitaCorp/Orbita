import { IsIn, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

// Rango del gráfico: mismos presets que sugiere la UI (7/30/90/180 días) — no
// se admite rango custom en esta primera versión, ver decisión en Jira.
export class SeriesQueryDto {
  @IsOptional() @Type(() => Number) @IsIn([7, 30, 90, 180]) days?: number;
}
