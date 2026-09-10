import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Auditoría interna 10/09, ítem `api.tags`: antes el nombre no tenía tope ni
// se recortaba (" verano" y "verano" eran dos etiquetas distintas).
export class UpsertTagDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name!: string;
}
