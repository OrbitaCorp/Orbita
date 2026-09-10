import { IsBoolean, IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Mismos topes que CreateBranchDto (auditoría interna 10/09, ítem `api.branches`).
// `isDefault` no está a propósito: la sucursal principal es la que crea el
// alta y no se reasigna desde acá.
export class UpdateBranchDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsLatitude() latitude?: number;
  @IsOptional() @IsLongitude() longitude?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
