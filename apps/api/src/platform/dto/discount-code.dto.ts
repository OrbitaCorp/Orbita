import { IsString, IsOptional, IsInt, IsBoolean, Min, Max, Length, Matches } from 'class-validator';

// Códigos de descuento de plataforma: los que Órbita le da a un negocio sobre
// SU suscripción.
//
// El tope es 99 y no 100 a propósito: Mercado Pago rechaza un preapproval con
// transaction_amount 0, así que un 100% no puede pasar por el flujo de cobro.
// Para regalar el servicio ya existe "Ceder licencia de cortesía" (Subscription
// con origin COMP), que es el mecanismo pensado para eso.
export class CreateDiscountCodeDto {
  @IsString()
  @Length(3, 32)
  // Sin espacios ni símbolos: el código se dicta por teléfono o se pega en un
  // mail, y cualquier cosa rara termina en un "no me funciona".
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'El código solo puede tener letras, números, guion y guion bajo' })
  code!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  percentOff!: number;

  // null / ausente = sin límite de usos.
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number | null;

  @IsOptional()
  @IsString()
  expiresAt?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  note?: string | null;
}

export class UpdateDiscountCodeDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  percentOff?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  expiresAt?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  note?: string | null;
}
