import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { AllowWhenPaused } from '../common/decorators/allow-when-paused.decorator';
import { MemberProfileService } from './member-profile.service';
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
  constructor(private readonly memberProfileService: MemberProfileService) {}

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
  @Post('change-password')
  changePassword(@CurrentUser() ctx: AuthContext, @Body() dto: ChangePasswordDto) {
    const { memberId } = assertMemberContext(ctx);
    return this.memberProfileService.changePassword(memberId, dto);
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
