import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

// Guarda como foto del producto una sugerida de la web: el servidor la baja y
// la sube a nuestro storage como cualquier otra (nunca se enlaza la URL externa).
export class AddImageFromWebDto {
  @IsString()
  @MaxLength(2000)
  url!: string;

  @IsOptional() @IsUUID() optionValueId?: string;

  @IsOptional() @IsBoolean() isPrimary?: boolean;
}
