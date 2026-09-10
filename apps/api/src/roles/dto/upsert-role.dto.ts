import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

// Topes (auditoría interna 10/09, ítem `api.roles`). El color se pinta en el
// panel (chip y tarjeta del rol): hex y nada más, como los que ofrece
// ModalRol. Los nombres reservados y repetidos se validan en RolesService.
export class UpsertRoleDto {
  @IsString() @IsNotEmpty() @MaxLength(40) name!: string;
  @IsOptional() @IsString() @MaxLength(200) description?: string;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/, { message: 'color debe ser un color hex' }) color?: string;
  @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) @MaxLength(60, { each: true }) permissions!: string[];
}
