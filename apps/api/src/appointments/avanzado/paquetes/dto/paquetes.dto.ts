import { Type } from 'class-transformer';
import { IsBoolean, IsBooleanString, IsInt, IsNumber, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { ClienteNuevoDto, ConMedioDePagoDto } from '../../comun/dtos-comunes';
import { PaginacionDto } from '../../comun/paginado';

// Paquetes y bonos (CONTRATO § P4.1).
export class UpsertPackageDto {
  @IsUUID('4')
  serviceId!: string;

  @IsInt()
  @Min(2, { message: 'Un paquete tiene al menos 2 sesiones.' })
  @Max(100)
  sessions!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Poné un precio.' })
  @Max(100_000_000)
  price!: number;

  @IsInt()
  @Min(0)
  @Max(730)
  validDays!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SellPackageDto extends ConMedioDePagoDto {
  @IsUUID('4')
  packageId!: string;

  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ClienteNuevoDto)
  customer?: ClienteNuevoDto;
}

export class ListPurchasesQuery extends PaginacionDto {
  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @IsOptional()
  @IsBooleanString()
  active?: string;
}
