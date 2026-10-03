import { IsEmail, IsIn, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { MEDIOS_EN_EL_LOCAL, MedioEnElLocal } from '../../comun/dtos-comunes';
import { PaginacionDto } from '../../comun/paginado';

// Gift cards (CONTRATO § P4.3).
export const ESTILOS_GIFT_CARD = ['noche', 'papel', 'aurora', 'marca'] as const;

class DatosGiftCardDto {
  @IsIn(['AMOUNT', 'SERVICE'])
  kind!: 'AMOUNT' | 'SERVICE';

  @ValidateIf((o: DatosGiftCardDto) => o.kind === 'AMOUNT')
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(10_000_000)
  amount?: number;

  @ValidateIf((o: DatosGiftCardDto) => o.kind === 'SERVICE')
  @IsUUID('4')
  serviceId?: string;

  @IsIn(ESTILOS_GIFT_CARD as unknown as string[])
  style!: (typeof ESTILOS_GIFT_CARD)[number];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  recipientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  senderName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  message?: string;
}

/** Emitir en el local (ya cobrada). */
export class EmitGiftCardDto extends DatosGiftCardDto {
  @IsIn(MEDIOS_EN_EL_LOCAL as unknown as string[], { message: 'Elegí cómo se pagó.' })
  method!: MedioEnElLocal;

  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  buyerName?: string;

  @IsOptional()
  @Matches(/^[\d\s+()-]{8,20}$/, { message: 'El teléfono tiene que tener al menos 8 dígitos.' })
  buyerPhone?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Ese email no es válido.' })
  @MaxLength(254)
  buyerEmail?: string;
}

/** Comprar desde el sitio (se paga con Mercado Pago). */
export class BuyGiftCardDto extends DatosGiftCardDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  buyerName!: string;

  @Matches(/^[\d\s+()-]{8,20}$/, { message: 'Faltan dígitos: son 10 con el código de área.' })
  buyerPhone!: string;

  @IsEmail({}, { message: 'Ese email no es válido.' })
  @MaxLength(254)
  buyerEmail!: string;
}

export const ESTADOS_GIFT_CARD = ['active', 'used', 'expired', 'voided', 'unpaid'] as const;

export class ListGiftCardsQuery extends PaginacionDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsIn(ESTADOS_GIFT_CARD as unknown as string[])
  status?: (typeof ESTADOS_GIFT_CARD)[number];
}
