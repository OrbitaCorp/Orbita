import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsUUID, IsEmail, IsArray, IsIn, IsObject, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertCategoryDto {
  @IsString() name!: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() color?: string;
  // null explícito = "sacar la imagen" (vuelve a mostrar ícono+color en el
  // storefront); undefined = no tocar el campo. Mismo criterio que logoUrl
  // en update-storefront-config.dto.ts.
  @IsOptional() @IsString() imageUrl?: string | null;
  @IsOptional() @IsUUID() parentId?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
