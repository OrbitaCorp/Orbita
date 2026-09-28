import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AiVariantsDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  // Descripción ya escrita, si la hay: ayuda a distinguir versiones del mismo producto.
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}
