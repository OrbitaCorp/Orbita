import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsUUID, IsEmail, IsArray, IsIn, IsObject, ValidateNested, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SuspendBusinessDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}
