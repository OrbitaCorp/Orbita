import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Topes (auditoría interna 10/09, ítem `api.branches`): antes el nombre podía
// llegar vacío y los dos textos no tenían largo.
export class CreateBranchDto {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
