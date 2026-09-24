import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RecordVisitDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  domain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  path?: string;
}
