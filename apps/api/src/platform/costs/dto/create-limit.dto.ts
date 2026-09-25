import { IsString, IsOptional, IsNumber, IsArray, IsIn, IsInt, Min, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLimitDto {
  @IsOptional() @IsString() providerSlug?: string | null;
  @IsIn(['SPEND', 'USAGE']) type!: string;
  @IsOptional() @IsString() category?: string;
  @Type(() => Number) @IsNumber() @Min(0) threshold!: number;
  @IsString() unit!: string;
  @IsArray() @ArrayMinSize(1) @IsInt({ each: true }) alertAtPercent!: number[];
}
