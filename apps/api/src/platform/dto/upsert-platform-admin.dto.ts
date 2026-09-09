import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsUUID, IsEmail, IsArray, IsIn, IsObject, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { NormalizedEmail } from '../../common/decorators/normalized-email.decorator';

export class UpsertPlatformAdminDto {
  @IsString() name!: string;
  @NormalizedEmail() email!: string;
  @IsIn(['SUPERADMIN', 'OPERATOR']) role!: 'SUPERADMIN' | 'OPERATOR';
}
