import { IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';

// Lista de espera de turnos (CONTRATO § P4.8).
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export class ListWaitlistQuery {
  @IsOptional()
  @Matches(FECHA, { message: 'La fecha tiene que ser AAAA-MM-DD.' })
  date?: string;

  @IsOptional()
  @IsIn(['WAITING', 'OFFERED', 'ACCEPTED', 'EXPIRED', 'CANCELLED'])
  status?: 'WAITING' | 'OFFERED' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
}

export class OfferWaitlistDto {
  @Matches(FECHA, { message: 'La fecha tiene que ser AAAA-MM-DD.' })
  date!: string;

  @IsInt()
  @Min(0)
  @Max(1439)
  startMin!: number;

  @IsUUID('4')
  resourceId!: string;
}

export class JoinWaitlistDto {
  @IsUUID('4')
  serviceId!: string;

  @IsOptional()
  @ValidateIf((o: JoinWaitlistDto) => o.resourceId !== 'cualquiera')
  @IsUUID('4')
  resourceId?: string;

  @Matches(FECHA, { message: 'La fecha tiene que ser AAAA-MM-DD.' })
  date!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  fromMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  toMin?: number;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @Matches(/^[\d\s+()-]{8,20}$/, { message: 'Faltan dígitos: son 10 con el código de área.' })
  phone!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Ese email no es válido.' })
  @MaxLength(254)
  email?: string;
}

export class AcceptOfferDto {
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  offer!: string;
}
