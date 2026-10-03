import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { AuthContext } from '../../../common/types/auth-context.type';
import { assertMemberContext } from '../../../common/utils/assert-member-context';
import { InvitePersonDto, PayFormDto, UpsertPersonDto, UpsertTurnosRoleDto } from './dto/equipo.dto';
import { EquipoService } from './equipo.service';
import { RolesTurnosService } from './roles-turnos.service';

// Equipo de Turnos (CONTRATO § P3.3). OJO: invitar acá se abre con
// `appointments.team.manage` (el "Encargado/a" de fábrica lo tiene), no con
// @Roles('owner','admin') como MembersController.invite: por eso se llama al
// service y no al controller. La regla anti-escalada vive en el service.
@Controller('appointments/team')
export class EquipoController {
  constructor(private readonly equipo: EquipoService) {}

  @Get()
  @RequirePermission('appointments.agenda.view')
  listar(@CurrentBusiness() ctx: AuthContext) {
    return this.equipo.listar(assertMemberContext(ctx));
  }

  @Post('invite')
  @RequirePermission('appointments.team.manage')
  invitar(@CurrentBusiness() ctx: AuthContext, @Body() dto: InvitePersonDto) {
    return this.equipo.invitar(assertMemberContext(ctx), dto);
  }

  @Post()
  @RequirePermission('appointments.team.manage')
  crear(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertPersonDto) {
    return this.equipo.crear(assertMemberContext(ctx), dto);
  }

  @Put(':resourceId')
  @RequirePermission('appointments.team.manage')
  editar(@CurrentBusiness() ctx: AuthContext, @Param('resourceId', new ParseUUIDPipe()) resourceId: string, @Body() dto: UpsertPersonDto) {
    return this.equipo.editar(assertMemberContext(ctx), resourceId, dto);
  }

  @Put(':resourceId/pay')
  @RequirePermission('appointments.earnings.settle')
  cambiarPago(@CurrentBusiness() ctx: AuthContext, @Param('resourceId', new ParseUUIDPipe()) resourceId: string, @Body() dto: PayFormDto) {
    return this.equipo.cambiarPago(assertMemberContext(ctx), resourceId, dto);
  }

  @Delete(':resourceId')
  @RequirePermission('appointments.team.manage')
  borrar(@CurrentBusiness() ctx: AuthContext, @Param('resourceId', new ParseUUIDPipe()) resourceId: string) {
    return this.equipo.borrar(assertMemberContext(ctx), resourceId);
  }
}

@Controller('appointments/roles')
export class RolesTurnosController {
  constructor(private readonly roles: RolesTurnosService) {}

  @Get()
  @RequirePermission('appointments.team.manage')
  listar(@CurrentBusiness() ctx: AuthContext) {
    return this.roles.listar(assertMemberContext(ctx));
  }

  @Post()
  @RequirePermission('appointments.team.manage')
  crear(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertTurnosRoleDto) {
    return this.roles.crear(assertMemberContext(ctx), dto);
  }

  @Put(':id')
  @RequirePermission('appointments.team.manage')
  editar(@CurrentBusiness() ctx: AuthContext, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpsertTurnosRoleDto) {
    return this.roles.editar(assertMemberContext(ctx), id, dto);
  }

  @Post(':id/reset')
  @RequirePermission('appointments.team.manage')
  restablecer(@CurrentBusiness() ctx: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.roles.restablecer(assertMemberContext(ctx), id);
  }

  @Delete(':id')
  @RequirePermission('appointments.team.manage')
  borrar(@CurrentBusiness() ctx: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.roles.borrar(assertMemberContext(ctx), id);
  }
}
