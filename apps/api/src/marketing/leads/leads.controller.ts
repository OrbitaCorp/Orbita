import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SuperadminYMarketing } from '../../common/decorators/platform-role.decorator';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { PlatformAdminContext } from '../../common/types/auth-context.type';
import { LeadsDiscoveryService } from './leads-discovery.service';
import { ActualizarLeadDto, BuscarLeadsDto, CrearLeadDto } from './leads.dto';
import { LeadsService } from './leads.service';

interface RequestWithAdmin {
  user: PlatformAdminContext;
}

@UseGuards(PlatformAdminGuard)
@SuperadminYMarketing()
@Controller('platform/marketing/leads')
export class LeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly discovery: LeadsDiscoveryService,
  ) {}

  @Get()
  listar(
    @Query('rubro') rubro?: string,
    @Query('clasificacion') clasificacion?: string,
    @Query('estado') estado?: string,
    @Query('localidad') localidad?: string,
    @Query('q') q?: string,
  ) {
    return this.leads.listar({ rubro, clasificacion, estado, localidad, q });
  }

  @Get('busquedas')
  estadoBusquedas() {
    return this.discovery.estadoBusquedas();
  }

  @Post('buscar')
  buscarMas(@Req() req: RequestWithAdmin, @Body() dto: BuscarLeadsDto) {
    return this.discovery.buscarMas(req.user.adminId, dto);
  }

  @Post()
  crear(@Req() req: RequestWithAdmin, @Body() dto: CrearLeadDto) {
    return this.leads.crear(req.user.adminId, dto);
  }

  @Patch(':id')
  actualizar(@Req() req: RequestWithAdmin, @Param('id') id: string, @Body() dto: ActualizarLeadDto) {
    return this.leads.actualizar(req.user.adminId, id, dto);
  }

  @Delete(':id')
  eliminar(@Param('id') id: string) {
    return this.leads.eliminar(id);
  }
}
