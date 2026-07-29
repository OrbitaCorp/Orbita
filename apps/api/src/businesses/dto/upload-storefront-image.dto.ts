import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class UploadStorefrontImageDto {
  // multipart/form-data envía todo como string ("true"/"false").
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value === 'true' : value))
  @IsBoolean()
  removeBackground?: boolean;
}
