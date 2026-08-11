import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { MembersService } from './members.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { ResetMemberPasswordDto } from './dto/reset-member-password.dto';

@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @RequirePermission('config.team.view')
  findAll(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.membersService.findAll(member.businessId);
  }

  // Igual que la creación de roles: invitar queda restringido a owner/admin además
  // del permiso, para que un rol custom con config.team.manage no pueda sumar gente
  // al equipo por su cuenta.
  @Post('invite')
  @Roles('owner', 'admin')
  @RequirePermission('config.team.manage')
  invite(@CurrentBusiness() ctx: AuthContext, @Body() dto: InviteMemberDto) {
    const member = assertMemberContext(ctx);
    return this.membersService.invite(member.businessId, dto);
  }

  // Igual que crear/editar roles: además del permiso, restringido a owner/admin.
  // Es zona peligrosa — un rol custom con config.team.manage no debería poder
  // reasignar roles (y menos ascender a alguien, o a sí mismo, a owner).
  @Put(':id')
  @Roles('owner', 'admin')
  @RequirePermission('config.team.manage')
  update(
    @CurrentBusiness() ctx: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateMemberDto,
  ) {
    const member = assertMemberContext(ctx);
    return this.membersService.update(member.businessId, member.memberId, member.roleName, id, dto);
  }

  // (Fase 4 — Alex) Genera una contraseña temporal nueva para el miembro.
  // Mismo gate que invitar: owner/admin + permiso de gestión del equipo.
  @Post(':id/reset-password')
  @Roles('owner', 'admin')
  @RequirePermission('config.team.manage')
  resetPassword(
    @CurrentBusiness() ctx: AuthContext,
    @Param('id') id: string,
    @Body() dto: ResetMemberPasswordDto,
  ) {
    const member = assertMemberContext(ctx);
    return this.membersService.resetPassword(member.businessId, id, dto.sendEmail ?? false);
  }

  @Delete(':id')
  @Roles('owner')
  @RequirePermission('config.team.manage')
  remove(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.membersService.remove(member.businessId, id);
  }
}
