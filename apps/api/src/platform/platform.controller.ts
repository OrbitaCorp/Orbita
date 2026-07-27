import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { PlatformAdminContext } from '../common/types/auth-context.type';
import { PlatformService } from './platform.service';
import { ListBusinessesQueryDto } from './dto/list-businesses-query.dto';
import { SuspendBusinessDto } from './dto/suspend-business.dto';
import { GrantCompDto } from './dto/grant-comp.dto';
import { UpsertPlatformAdminDto } from './dto/upsert-platform-admin.dto';

// El AuthGuard global ya pobló req.user con el contexto del admin (verificado y
// activo). Acá se lee el adminId para la auditoría de las acciones.
interface RequestWithAdmin {
  user: PlatformAdminContext;
}

// Todos los endpoints exigen un super admin autenticado (PlatformAdminGuard).
@UseGuards(PlatformAdminGuard)
@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  // ── Dashboard / lecturas ──────────────────────────────────────────────────

  @Get('overview')
  overview() {
    return this.platformService.overview();
  }

  @Get('businesses')
  listBusinesses(@Query() query: ListBusinessesQueryDto) {
    return this.platformService.listBusinesses(query);
  }

  @Get('businesses/:businessId')
  getBusiness(@Param('businessId') businessId: string) {
    return this.platformService.getBusiness(businessId);
  }

  @Get('domains')
  listDomains() {
    return this.platformService.listDomains();
  }

  @Get('owners')
  listOwners() {
    return this.platformService.listOwners();
  }

  @Get('subscriptions')
  listSubscriptions() {
    return this.platformService.listSubscriptions();
  }

  // ── Acciones ──────────────────────────────────────────────────────────────

  @Post('businesses/:businessId/suspend')
  suspend(
    @Req() req: RequestWithAdmin,
    @Param('businessId') businessId: string,
    @Body() dto: SuspendBusinessDto,
  ) {
    return this.platformService.suspendBusiness(req.user.adminId, businessId, dto);
  }

  @Post('businesses/:businessId/reactivate')
  reactivate(@Req() req: RequestWithAdmin, @Param('businessId') businessId: string) {
    return this.platformService.reactivateBusiness(req.user.adminId, businessId);
  }

  @Post('subscriptions/:businessId/grant-comp')
  grantComp(
    @Req() req: RequestWithAdmin,
    @Param('businessId') businessId: string,
    @Body() dto: GrantCompDto,
  ) {
    return this.platformService.grantComp(req.user.adminId, businessId, dto);
  }

  // ── Admins de plataforma ──────────────────────────────────────────────────

  @Get('admins')
  listAdmins() {
    return this.platformService.listAdmins();
  }

  @Post('admins')
  createAdmin(@Req() req: RequestWithAdmin, @Body() dto: UpsertPlatformAdminDto) {
    return this.platformService.createAdmin(req.user.adminId, dto);
  }

  @Put('admins/:id')
  updateAdmin(@Req() req: RequestWithAdmin, @Param('id') id: string, @Body() dto: UpsertPlatformAdminDto) {
    return this.platformService.updateAdmin(req.user.adminId, id, dto);
  }

  @Delete('admins/:id')
  removeAdmin(@Req() req: RequestWithAdmin, @Param('id') id: string) {
    return this.platformService.removeAdmin(req.user.adminId, id);
  }
}
