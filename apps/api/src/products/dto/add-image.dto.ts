import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class AddImageDto {
  @IsOptional() @IsUUID() optionValueId?: string;
  // multipart/form-data envía todo como string ("true"/"false").
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value === 'true' : value))
  @IsBoolean()
  isPrimary?: boolean;
  // Paquete "Avanzado" — corre BackgroundRemovalService antes de guardar la
  // imagen (mismo modelo local ya usado para las fotos del hero, ver
  // businesses.service.ts#uploadStorefrontImage). Gateado en el service, no acá:
  // el resto del endpoint sigue disponible sin el add-on.
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value === 'true' : value))
  @IsBoolean()
  removeBackground?: boolean;
}
