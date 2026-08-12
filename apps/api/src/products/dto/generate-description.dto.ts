import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class GenerateDescriptionDto {
  @IsString() @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(60) categoryName?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  // Descripción ya escrita por el usuario, si la hay — se usa como contexto
  // para que Orbi la mejore/extienda en vez de ignorarla.
  @IsOptional() @IsString() @MaxLength(2000) existingDescription?: string;
}
