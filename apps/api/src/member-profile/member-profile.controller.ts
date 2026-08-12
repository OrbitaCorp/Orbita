import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { MemberProfileService } from './member-profile.service';
import { UpdateMemberProfileDto } from './dto/update-member-profile.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';

// (RBT-646) "Mi perfil" del panel. Ver el comentario en member-profile.service.ts
// sobre por qué esto no vive en `me/`.
@Controller('member-profile')
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

  // Endpoint aparte del resto del perfil: se llama sin fricción cada vez que
  // se cambia el tema desde "Mi perfil" (RBT-646), sin tener que reenviar
  // nombre/email en el mismo request.
  @Patch('theme')
  updateTheme(@CurrentUser() ctx: AuthContext, @Body() dto: UpdateThemeDto) {
    const { memberId } = assertMemberContext(ctx);
    return this.memberProfileService.updateTheme(memberId, dto.themePreference);
  }
}
