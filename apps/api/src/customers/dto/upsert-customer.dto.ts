import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';
import { NormalizedEmail } from '../../common/decorators/normalized-email.decorator';

export class UpsertCustomerDto {
  // firstName no puede venir vacío: alimenta el customerName derivado en
  // pedidos/devoluciones (quedaba "" en toda la app). MaxLength en todos para
  // no persistir strings enormes que igual entran hasta el límite del body.
  @IsString() @IsNotEmpty() @MaxLength(120) firstName!: string;
  @IsOptional() @IsString() @MaxLength(120) lastName?: string;
  @IsOptional() @NormalizedEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(30) dni?: string;
}
