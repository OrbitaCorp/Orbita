import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpsertAddressDto {
  @IsOptional() @IsString() alias?: string;
  @IsString() street!: string;
  @IsOptional() @IsString() floor?: string;
  @IsOptional() @IsString() depto?: string;
  @IsOptional() @IsString() referencia?: string;
  @IsOptional() @IsString() provincia?: string;
  @IsString() city!: string;
  @IsOptional() @IsString() zip?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
