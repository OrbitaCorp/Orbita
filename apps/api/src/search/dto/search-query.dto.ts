import { IsOptional, IsString, MaxLength } from 'class-validator';

// Antes el controller leía `@Query('q')` crudo, sin pasar por
// ValidationPipe: sin tope de largo, y `?q=a&q=b` llegaba como array y
// `q.trim()` rompía con un 500 (auditoría interna 10/09, ítem `api.search`;
// era uno de los ejemplos del hallazgo "query params sin DTO").
export class SearchQueryDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
}
