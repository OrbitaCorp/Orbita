import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, IsUUID, IsEmail, IsArray, IsIn, IsObject, ValidateNested, ValidateIf, MaxLength, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { NormalizedEmail, normalizeEmail } from '../../common/decorators/normalized-email.decorator';

export class UpsertPlatformAdminDto {
  @IsString() @MaxLength(80) name!: string;
  @NormalizedEmail() email!: string;
  @IsIn(['SUPERADMIN', 'OPERATOR']) role!: 'SUPERADMIN' | 'OPERATOR';
  // Cargo con el que firma en Soporte ("CEO", "CTO"). Vacío = sin cargo.
  @IsOptional() @IsString() @MaxLength(40) jobTitle?: string;
  // Correo personal (Gmail, etc.): a donde viaja la contraseña temporal y, además del correo de la
  // cuenta, el código del segundo factor. Vacío = sin correo personal; ausente = no se toca.
  @ValidateIf((_o, v) => typeof v === 'string' && v.trim() !== '')
  @Transform(({ value }) => normalizeEmail(value))
  @IsEmail() @MaxLength(120)
  personalEmail?: string;
}
