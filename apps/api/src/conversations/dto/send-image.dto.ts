import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

// Pie de foto de una imagen que se manda por WhatsApp (WhatsApp admite hasta 1024 caracteres). La foto viaja aparte
// (multipart, campo `file`).
export class SendImageDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1024)
  texto?: string;
}
