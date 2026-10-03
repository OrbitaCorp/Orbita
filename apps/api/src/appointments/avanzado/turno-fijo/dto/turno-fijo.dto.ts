import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Matches, Max, Min, ValidateNested } from 'class-validator';
import { ClienteNuevoDto } from '../../comun/dtos-comunes';

// Turno fijo (CONTRATO § P4.6).
export class CreateRecurringDto {
  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ClienteNuevoDto)
  customer?: ClienteNuevoDto;

  @IsUUID('4')
  resourceId!: string;

  @IsUUID('4')
  serviceId!: string;

  @IsIn(['WEEKLY', 'BIWEEKLY', 'MONTHLY'])
  frequency!: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha tiene que ser AAAA-MM-DD.' })
  startDate!: string;

  @IsInt()
  @Min(0)
  @Max(1439)
  startMin!: number;

  @IsInt()
  @Min(1)
  @Max(52)
  occurrences!: number;
}
