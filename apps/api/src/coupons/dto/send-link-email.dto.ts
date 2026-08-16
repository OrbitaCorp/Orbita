import { IsEmail, IsString, IsNotEmpty, MaxLength } from 'class-validator';

// Envío libre del link de un cupón exclusivo — a propósito NO valida que
// `to` sea un cliente registrado del negocio (puede ser cualquier persona).
// Si el email no existe, Resend lo rechaza y ahí queda, sin romper nada del
// lado del panel (ver CouponsService.sendLinkEmail).
export class SendCouponLinkEmailDto {
  @IsEmail() to!: string;
  @IsString() @IsNotEmpty() @MaxLength(150) subject!: string;
  @IsString() @IsNotEmpty() @MaxLength(5000) body!: string;
}
