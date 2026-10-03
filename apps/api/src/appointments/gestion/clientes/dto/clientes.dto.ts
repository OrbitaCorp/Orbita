import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { NormalizedEmail } from '../../../../common/decorators/normalized-email.decorator';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** GET appointments/clients */
export class ListClientsQueryDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsIn(['todos', 'frecuentes', 'nuevos']) filter?: 'todos' | 'frecuentes' | 'nuevos';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

/**
 * POST appointments/clients. `null` en un campo opcional = borrarlo (en el
 * PUT); ausente = dejarlo como está.
 */
export class CreateClientDto {
  @Transform(recortar) @IsString() @MinLength(3, { message: 'El nombre tiene que tener al menos 3 letras.' }) @MaxLength(120) name!: string;
  /** Se normaliza a dígitos; tiene que tener al menos 8. */
  @IsOptional() @IsString() @MaxLength(40) phone?: string | null;
  @IsOptional() @NormalizedEmail() email?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) note?: string | null;
  @IsOptional() @Transform(recortar) @IsString() @IsNotEmpty() @MaxLength(120) insuranceName?: string | null;
}

/** PUT appointments/clients/:id */
export class UpdateClientDto extends CreateClientDto {
  @IsOptional() @IsString() @MaxLength(60) insuranceNumber?: string | null;
  @IsOptional() @IsString() @MaxLength(20) dni?: string | null;
}
