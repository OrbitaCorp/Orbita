import { IsString, IsNumber, IsOptional, IsObject, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSnapshotDto {
  @IsString() providerSlug!: string;
  @Matches(/^\d{4}-\d{2}$/) month!: string;
  @Type(() => Number) @IsNumber() @Min(0) amountUsd!: number;
  @IsOptional() @IsObject() breakdown?: Record<string, number>;
}
