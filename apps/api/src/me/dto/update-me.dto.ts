import { IsDateString, IsEmail, IsOptional, IsString } from 'class-validator';

// (RBT-630) Edición del perfil del cliente del storefront. Todos opcionales:
// el cliente puede tocar solo el campo que quiera. El email, si viene, se
// valida único DENTRO del negocio (ver MeService.updateProfile).
export class UpdateMeDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() dni?: string;
  @IsOptional() @IsDateString() birthDate?: string;
}
