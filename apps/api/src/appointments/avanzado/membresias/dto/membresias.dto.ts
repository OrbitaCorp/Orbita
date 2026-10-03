import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { ClienteNuevoDto, ConMedioDePagoDto } from '../../comun/dtos-comunes';
import { PaginacionDto } from '../../comun/paginado';

// Membresías y abonos (CONTRATO § P4.2).
export class UpsertMembershipPlanDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsInt()
  @Min(0)
  @Max(14)
  perWeek!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Poné un precio.' })
  @Max(100_000_000)
  price!: number;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateMembershipDto extends ConMedioDePagoDto {
  @IsUUID('4')
  planId!: string;

  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ClienteNuevoDto)
  customer?: ClienteNuevoDto;
}

export class PauseMembershipDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha tiene que ser AAAA-MM-DD.' })
  until!: string;
}

export class ListMembershipsQuery extends PaginacionDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED', 'PAST_DUE', 'CANCELLED'])
  status?: 'ACTIVE' | 'PAUSED' | 'PAST_DUE' | 'CANCELLED';
}
