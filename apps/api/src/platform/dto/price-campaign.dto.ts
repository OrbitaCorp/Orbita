import { IsString, IsOptional, IsInt, IsBoolean, IsNumber, Min, Max, Length, Matches } from 'class-validator';

// Campañas de precio congelado: "los primeros N comercios pagan $X por mes
// durante M meses, después el precio de lista". Ver el modelo PriceCampaign en
// schema.prisma para la diferencia entre una pública (sin código, se aplica
// sola y se muestra en la landing) y una privada (con código, cortesía).
export class CreatePriceCampaignDto {
  @IsString()
  @Length(3, 60)
  name!: string;

  // Ausente o vacío = campaña pública. Mismo formato que los códigos de
  // descuento: se dicta por teléfono o se pega en un mail.
  @IsOptional()
  @IsString()
  @Length(0, 32)
  @Matches(/^[a-zA-Z0-9_-]*$/, { message: 'El código solo puede tener letras, números, guion y guion bajo' })
  code?: string | null;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  priceBase!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  priceAdvanced!: number;

  // Cuántos meses dura el precio congelado, contando el que se paga en el alta.
  @IsInt()
  @Min(1)
  @Max(12)
  months!: number;

  // null / ausente = sin cupo.
  @IsOptional()
  @IsInt()
  @Min(1)
  maxSlots?: number | null;

  @IsOptional()
  @IsString()
  startsAt?: string | null;

  @IsOptional()
  @IsString()
  endsAt?: string | null;

  // Nace apagada salvo que se pida lo contrario: prender una pública cambia lo
  // que ve y paga todo el que entra a registrarse.
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  note?: string | null;
}

// Precios de lista de los seis planes (período × Base / Base + Avanzado): lo que
// se cobra por período, comisión de Mercado Pago incluida. Van siempre los
// seis: se guardan solo los que cambiaron.
export class UpdatePlanPricesDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) mensual!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) semestral!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) anual!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) mensualAvanzado!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) semestralAvanzado!: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) anualAvanzado!: number;
}

// El código no se edita: es lo que distingue una pública de una privada y lo
// que ya se le pudo haber pasado a alguien.
export class UpdatePriceCampaignDto {
  @IsOptional()
  @IsString()
  @Length(3, 60)
  name?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  priceBase?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  priceAdvanced?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  months?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxSlots?: number | null;

  @IsOptional()
  @IsString()
  startsAt?: string | null;

  @IsOptional()
  @IsString()
  endsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  note?: string | null;
}
