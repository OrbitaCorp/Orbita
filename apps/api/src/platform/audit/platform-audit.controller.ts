import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { PlatformAdminContext } from '../../common/types/auth-context.type';
import { PlatformAuditService } from './platform-audit.service';
import { CreateAuditItemDto, UpdateAuditItemDto } from './dto/audit-item.dto';

interface RequestWithAdmin {
  user: PlatformAdminContext;
}

// Auditoría interna del equipo (super admin → Auditoría). Mismo guard que el
// resto de /platform: cualquier admin de plataforma (SUPERADMIN u OPERATOR)
// puede leer y editar — la idea es que todo el equipo vaya tildando.
@UseGuards(PlatformAdminGuard)
@Controller('platform/audit')
export class PlatformAuditController {
  constructor(private readonly audit: PlatformAuditService) {}

  @Get()
  listar() {
    return this.audit.listar();
  }

  @Post('items')
  crear(@Req() req: RequestWithAdmin, @Body() dto: CreateAuditItemDto) {
    return this.audit.crear(req.user.adminId, dto);
  }

  @Put('items/:id')
  actualizar(@Req() req: RequestWithAdmin, @Param('id') id: string, @Body() dto: UpdateAuditItemDto) {
    return this.audit.actualizar(req.user.adminId, id, dto);
  }

  @Delete('items/:id')
  borrar(@Req() req: RequestWithAdmin, @Param('id') id: string) {
    return this.audit.borrar(req.user.adminId, id);
  }
}
