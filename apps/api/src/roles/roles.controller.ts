import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { RolesService } from './roles.service';
import { UpsertRoleDto } from './dto/upsert-role.dto';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermission('config.team.view')
  findAll(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.rolesService.findAll(member.businessId);
  }

  // Crear/editar/eliminar roles queda además restringido a owner/admin (no solo al
  // permiso config.team.manage): es una operación "zona peligrosa" — un rol custom
  // con ese permiso no debería poder crear otros roles con más privilegios que él.
  @Post()
  @Roles('owner', 'admin')
  @RequirePermission('config.team.manage')
  create(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertRoleDto) {
    const member = assertMemberContext(ctx);
    return this.rolesService.create(member.businessId, dto, member.memberId);
  }

  @Put(':id')
  @Roles('owner', 'admin')
  @RequirePermission('config.team.manage')
  update(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpsertRoleDto) {
    const member = assertMemberContext(ctx);
    return this.rolesService.update(member.businessId, id, dto, member.memberId);
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  @RequirePermission('config.team.manage')
  remove(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.rolesService.remove(member.businessId, id, member.memberId);
  }
}
