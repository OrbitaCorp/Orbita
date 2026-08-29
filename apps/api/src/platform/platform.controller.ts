import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { PlatformAdminContext } from '../common/types/auth-context.type';
import { PlatformService } from './platform.service';
import { ListBusinessesQueryDto } from './dto/list-businesses-query.dto';
import { SuspendBusinessDto } from './dto/suspend-business.dto';
import { GrantCompDto } from './dto/grant-comp.dto';
import { UpsertPlatformAdminDto } from './dto/upsert-platform-admin.dto';
import { ListLogsQueryDto } from './dto/list-logs-query.dto';
import { SeriesQueryDto } from './dto/series-query.dto';
import { SendMailTestDto } from './dto/send-mail-test.dto';
import { CreateDiscountCodeDto, UpdateDiscountCodeDto } from './dto/discount-code.dto';

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

  // Series para los gráficos del dashboard (RBT — dashboard de super admin).
  @Get('growth-series')
  growthSeries(@Query() query: SeriesQueryDto) {
    return this.platformService.growthSeries(query);
  }

  @Get('revenue-series')
  revenueSeries(@Query() query: SeriesQueryDto) {
    return this.platformService.revenueSeries(query);
  }

  @Get('businesses')
  listBusinesses(@Query() query: ListBusinessesQueryDto) {
    return this.platformService.listBusinesses(query);
  }

  @Get('businesses/:businessId')
  getBusiness(@Param('businessId') businessId: string) {
    return this.platformService.getBusiness(businessId);
  }

  @Get('businesses/:businessId/series')
  businessSeries(@Param('businessId') businessId: string, @Query() query: SeriesQueryDto) {
    return this.platformService.businessSeries(businessId, query);
  }

  @Get('businesses/:businessId/products')
  businessProducts(@Param('businessId') businessId: string) {
    return this.platformService.businessProducts(businessId);
  }

  @Get('businesses/:businessId/reviews')
  businessReviews(@Param('businessId') businessId: string) {
    return this.platformService.businessReviews(businessId);
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

  // Declarado antes de que cualquier ruta ambigua pueda pisarla — no hay
  // conflicto real hoy (no existe 'logs' como :businessId en otra ruta), pero
  // mismo criterio defensivo que products.controller.ts con 'stats'.
  @Get('logs')
  listLogs(@Query() query: ListLogsQueryDto) {
    return this.platformService.listLogs(query);
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

  // ── Testeo de plantillas de email (RBT-607) ─────────────────────────────

  @Get('mail-templates')
  listMailTemplates() {
    return this.platformService.listMailTemplates();
  }

  @Get('mail-templates/:id/preview')
  previewMailTemplate(@Param('id') id: string) {
    return this.platformService.previewMailTemplate(id);
  }

  @Post('mail-templates/:id/send-test')
  sendMailTest(@Param('id') id: string, @Body() dto: SendMailTestDto) {
    return this.platformService.sendMailTest(id, dto.to);
  }

  // ── Códigos de descuento de plataforma ────────────────────────────────────

  @Get('discount-codes')
  listDiscountCodes() {
    return this.platformService.listDiscountCodes();
  }

  @Get('discount-codes/:id')
  getDiscountCode(@Param('id') id: string) {
    return this.platformService.getDiscountCode(id);
  }

  @Post('discount-codes')
  createDiscountCode(@Req() req: RequestWithAdmin, @Body() dto: CreateDiscountCodeDto) {
    return this.platformService.createDiscountCode(req.user.adminId, dto);
  }

  @Put('discount-codes/:id')
  updateDiscountCode(@Req() req: RequestWithAdmin, @Param('id') id: string, @Body() dto: UpdateDiscountCodeDto) {
    return this.platformService.updateDiscountCode(req.user.adminId, id, dto);
  }
}
