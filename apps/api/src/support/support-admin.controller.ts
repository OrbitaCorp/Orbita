import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { PlatformAdminContext } from '../common/types/auth-context.type';
import { SupportService } from './support.service';
import { ListSupportQueryDto } from './dto/list-support-query.dto';
import { AdminReplyDto } from './dto/admin-reply.dto';
import { UpdateSupportStatusDto } from './dto/update-support-status.dto';

// El AuthGuard global ya pobló req.user con el contexto del admin (verificado
// y activo). Acá se lee el adminId para firmar la respuesta y el log.
interface RequestWithAdmin {
  user: PlatformAdminContext;
}

// Pestaña Soporte del superadmin. Vive en el módulo support (y no en
// platform) porque comparte el service y la serialización con el lado del
// negocio: una consulta se ve igual de los dos lados, con el negocio y el
// email del miembro de más para el equipo.
//
// Sin @SoloSuperadmin en ningún endpoint: responder y cerrar consultas es
// justamente el trabajo de un OPERATOR (soporte/operaciones). No toca plata,
// accesos ni el estado de un negocio. 'summary' va ANTES de ':id'.
@UseGuards(PlatformAdminGuard)
@Controller('platform/support')
export class SupportAdminController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  list(@Query() q: ListSupportQueryDto) {
    return this.supportService.adminList(q);
  }

  @Get('summary')
  summary() {
    return this.supportService.adminSummary();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.supportService.adminGet(id);
  }

  @Post(':id/reply')
  reply(@Req() req: RequestWithAdmin, @Param('id') id: string, @Body() dto: AdminReplyDto) {
    return this.supportService.adminReply(req.user.adminId, id, dto);
  }

  @Put(':id/status')
  setStatus(@Req() req: RequestWithAdmin, @Param('id') id: string, @Body() dto: UpdateSupportStatusDto) {
    return this.supportService.adminSetStatus(req.user.adminId, id, dto);
  }
}
