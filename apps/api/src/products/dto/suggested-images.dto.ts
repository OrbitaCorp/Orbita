import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SuggestedImagesDto {
  @IsString()
  @MaxLength(200)
  query!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  color?: string;
}
