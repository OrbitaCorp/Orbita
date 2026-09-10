import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Topes (auditoría interna 10/09, ítem `api.products`): un producto tiene
// como mucho 30 imágenes (ver ProductsService.addImage).
class ImageOrderItem {
  @IsUUID() id!: string;
  @IsInt() @Min(0) @Max(1000) position!: number;
}
export class ReorderImagesDto {
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ImageOrderItem) items!: ImageOrderItem[];
  @IsOptional() @IsUUID() primaryId?: string;
}
