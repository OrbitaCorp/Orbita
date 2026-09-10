import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { NormalizedEmail } from '../../common/decorators/normalized-email.decorator';

// Envío del link de un cupón exclusivo — a propósito NO valida que `to` sea
// un cliente registrado del negocio (puede ser cualquier persona). Si el email
// no existe, Resend lo rechaza y ahí queda, sin romper nada del lado del panel
// (ver CouponsService.sendLinkEmail).
//
// Desde la auditoría interna del 10/09 (ítem api.coupons) el panel ya no
// manda el asunto ni el HTML: los arma el servidor a partir del cupón. Antes
// este endpoint mandaba el HTML que le llegara, con el remitente de Órbita, a
// cualquier dirección.
export class SendCouponLinkEmailDto {
  @IsUUID() couponId!: string;
  @NormalizedEmail() to!: string;
  @IsOptional() @IsString() @MaxLength(80) nombreDestino?: string;
}
