import { IsOptional, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class MonthQueryDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}$/) month?: string;
}

export class MonthsQueryDto {
  @IsOptional() @Type(() => Number) months?: number;
}
