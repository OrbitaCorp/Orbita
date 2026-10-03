import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { CurrentBusiness } from '../../common/decorators/current-business.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AuthContext } from '../../common/types/auth-context.type';
import { assertMemberContext } from '../../common/utils/assert-member-context';
import { AppointmentServicesService } from './appointment-services.service';
import { ListServicesQueryDto, OrderServicesDto, UpsertServiceDto } from './dto/services.dto';

// Servicios de Turnos (CONTRATO.md § P1.2).
@Controller('appointments/services')
export class AppointmentServicesController {
  constructor(private readonly services: AppointmentServicesService) {}

  @Get()
  @RequirePermission('appointments.agenda.view')
  list(@CurrentBusiness() ctx: AuthContext, @Query() q: ListServicesQueryDto) {
    return this.services.listar(assertMemberContext(ctx).businessId, q.includeInactive ?? false);
  }

  @Post()
  @RequirePermission('appointments.services.manage')
  create(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertServiceDto) {
    return this.services.crear(assertMemberContext(ctx), dto);
  }

  // Antes que PUT :id (si no, "order" se tomaría como id).
  @Put('order')
  @RequirePermission('appointments.services.manage')
  order(@CurrentBusiness() ctx: AuthContext, @Body() dto: OrderServicesDto) {
    return this.services.ordenar(assertMemberContext(ctx), dto.ids);
  }

  @Put(':id')
  @RequirePermission('appointments.services.manage')
  update(@CurrentBusiness() ctx: AuthContext, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpsertServiceDto) {
    return this.services.actualizar(assertMemberContext(ctx), id, dto);
  }

  @Delete(':id')
  @RequirePermission('appointments.services.manage')
  remove(@CurrentBusiness() ctx: AuthContext, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.services.borrar(assertMemberContext(ctx), id);
  }
}
