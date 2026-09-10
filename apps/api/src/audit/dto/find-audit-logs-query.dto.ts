import { Type } from 'class-transformer';
import { IsInt, IsISO8601, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';

export class FindAuditLogsQueryDto {
  // "product", "role", "member", "business", "customer_export"...
  @IsOptional() @Matches(/^[a-z_]{1,40}$/, { message: 'entityType inválido' }) entityType?: string;
  @IsOptional() @IsUUID() memberId?: string;
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
