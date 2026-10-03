import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { CurrentBusiness } from '../../common/decorators/current-business.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuthContext } from '../../common/types/auth-context.type';
import { assertMemberContext } from '../../common/utils/assert-member-context';
import { AppointmentResourcesService } from './appointment-resources.service';
import { ListResourcesQueryDto, UpsertSpaceDto } from './dto/resources.dto';

// Agendas (CONTRATO.md § P1.3): el GET lista personas y espacios; las
// escrituras son de espacios (las personas se editan en Equipo, P3).
@Controller('appointments/resources')
export class AppointmentResourcesController {
  constructor(private readonly resources: AppointmentResourcesService) {}

  @Get()
  @RequirePermission('appointments.agenda.view')
  list(@CurrentBusiness() ctx: AuthContext, @Query() q: ListResourcesQueryDto) {
    return this.resources.listar(assertMemberContext(ctx), q);
  }

  @Post()
  @RequirePermission('appointments.team.manage')
  create(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertSpaceDto) {
    return this.resources.crear(assertMemberContext(ctx), dto);
  }

  @Put(':id')
  @RequirePermission('appointments.team.manage')
  update(@CurrentBusiness() ctx: AuthContext, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpsertSpaceDto) {
    return this.resources.actualizar(assertMemberContext(ctx), id, dto);
  }

  @Delete(':id')
  @RequirePermission('appointments.team.manage')
  remove(@CurrentBusiness() ctx: AuthContext, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.resources.borrar(assertMemberContext(ctx), id);
  }
}
