import { IsOptional, IsString, MaxLength } from 'class-validator';

// Todo opcional: activar el plan sin código es el caso normal y el frontend
// viejo ni manda body. Con código, vale solo para el primer cobro.
export class ActivatePlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  discountCode?: string;
}
