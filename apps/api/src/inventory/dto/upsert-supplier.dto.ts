import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { NormalizedEmail } from '../../common/decorators/normalized-email.decorator';

// Topes y email normalizado (auditoría interna 10/09, ítem `api.inventory`).
export class UpsertSupplierDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(120) contact?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @NormalizedEmail() email?: string;
}
