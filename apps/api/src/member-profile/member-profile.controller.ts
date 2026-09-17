import { Body, Controller, Get, Headers, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { AllowWhenPaused } from '../common/decorators/allow-when-paused.decorator';
import { MemberProfileService } from './member-profile.service';
import { EmailVerificationService } from './email-verification.service';
import { ConfirmarEmailDto } from './dto/confirmar-email.dto';
import { UpdateMemberProfileDto } from './dto/update-member-profile.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

// (RBT-646) "Mi perfil" del panel. Ver el comentario en member-profile.service.ts
// sobre por qué esto no vive en `me/`.
//
// Todo el controller queda afuera del modo "solo lectura" de una tienda
// suspendida (ver SubscriptionActiveGuard): el acceso propio (contraseña,
// tema, datos personales) es seguridad de la cuenta, no depende de si el
// negocio pagó o no — y de hecho el dueño necesita poder cambiar su
// contraseña para poder entrar a pagar si la perdió.
@Controller('member-profile')
@AllowWhenPaused()
export class MemberProfileController {
  constructor(
    private readonly memberProfileService: MemberProfileService,
    private readonly emailVerification: EmailVerificationService,
  ) {}

  @Get()
  getProfile(@CurrentUser() ctx: AuthContext) {
    const { memberId } = assertMemberContext(ctx);
    return this.memberProfileService.getProfile(memberId);
  }

  @Patch()
  updateProfile(@CurrentUser() ctx: AuthContext, @Body() dto: UpdateMemberProfileDto) {
    const { memberId, businessId } = assertMemberContext(ctx);
    return this.memberProfileService.updateProfile(memberId, businessId, dto);
  }

  // (Fase 4 — Alex) Cambio de contraseña desde "Mi perfil": la actual como
  // verificación, la nueva con mínimo 8 (mismas reglas que el resto).
  // Throttle propio: con una sesión robada, probar la contraseña actual de a
  // 60 por minuto era posible (auditoría interna 10/09, ítem web.panel.perfil).
  // `x-refresh-token` (opcional, lo manda un BFF): la sesión que se preserva.
  @Post('change-password')
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  changePassword(
    @CurrentUser() ctx: AuthContext,
    @Body() dto: ChangePasswordDto,
    @Headers('x-refresh-token') sesionActual?: string,
  ) {
    const { memberId } = assertMemberContext(ctx);
    return this.memberProfileService.changePassword(memberId, dto, sesionActual);
  }

  // ── Verificar el email (hallazgo `alta-sin-verificar-email`) ─────────────
  // No va en el wizard a propósito (decisión del 16/09): el member nace sin
  // verificar con 7 días de plazo y lo resuelve acá, desde "Mi perfil".

  @Get('verificar-email')
  estadoVerificacion(@CurrentUser() ctx: AuthContext) {
    const { memberId } = assertMemberContext(ctx);
    return this.emailVerification.estado(memberId);
  }

  // Manda el código al email del member. El throttle es por IP; el servicio
  // además espacia los envíos por member, que es lo que evita usar esto para
  // bombardear una casilla.
  @Post('verificar-email/enviar')
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  enviarCodigoVerificacion(@CurrentUser() ctx: AuthContext) {
    const { memberId } = assertMemberContext(ctx);
    return this.emailVerification.enviarCodigo(memberId);
  }

  // Mismo límite que el cambio de contraseña: un código de 6 dígitos sin
  // freno por IP se saca a fuerza bruta aunque cada fila aguante 5 intentos.
  @Post('verificar-email/confirmar')
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  confirmarEmail(@CurrentUser() ctx: AuthContext, @Body() dto: ConfirmarEmailDto) {
    const { memberId } = assertMemberContext(ctx);
    return this.emailVerification.confirmar(memberId, dto.code);
  }

  // Endpoint aparte del resto del perfil: se llama sin fricción cada vez que
  // se cambia el tema desde "Mi perfil" (RBT-646), sin tener que reenviar
  // nombre/email en el mismo request.
  @Patch('theme')
  updateTheme(@CurrentUser() ctx: AuthContext, @Body() dto: UpdateThemeDto) {
    const { memberId } = assertMemberContext(ctx);
    return this.memberProfileService.updateTheme(memberId, dto.themePreference);
  }
}
