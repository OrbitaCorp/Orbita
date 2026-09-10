import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Topes (auditoría interna 10/09, ítem `api.categories`). Que cada id y cada
// padre sean del negocio, y que no se armen ciclos, lo valida el service.
class ReorderItem {
  @IsUUID() id!: string;
  @IsInt() @Min(0) @Max(10_000) position!: number;
  @IsOptional() @IsUUID() parentId?: string | null;
}
export class ReorderCategoriesDto {
  @IsArray() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => ReorderItem) items!: ReorderItem[];
}
