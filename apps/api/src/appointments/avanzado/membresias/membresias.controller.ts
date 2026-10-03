import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { RequiresAddon } from '../../../common/decorators/requires-addon.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { AuthContext } from '../../../common/types/auth-context.type';
import { assertMemberContext } from '../../../common/utils/assert-member-context';
import { ConMedioDePagoDto } from '../comun/dtos-comunes';
import { MembresiasService } from './membresias.service';
import { CreateMembershipDto, ListMembershipsQuery, PauseMembershipDto, UpsertMembershipPlanDto } from './dto/membresias.dto';

// Membresías y abonos (CONTRATO § P4.2), lado del panel.
@Controller('appointments')
export class MembresiasController {
  constructor(private readonly membresias: MembresiasService) {}

  @Get('membership-plans')
  @RequiresAddon('ADVANCED')
  listarPlanes(@CurrentBusiness() ctx: AuthContext) {
    return this.membresias.listarPlanes(assertMemberContext(ctx).businessId);
  }

  @Post('membership-plans')
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.settings.manage')
  crearPlan(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertMembershipPlanDto) {
    const m = assertMemberContext(ctx);
    return this.membresias.crearPlan(m.businessId, m.memberId, dto);
  }

  @Put('membership-plans/:id')
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.settings.manage')
  editarPlan(@CurrentBusiness() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertMembershipPlanDto) {
    const m = assertMemberContext(ctx);
    return this.membresias.editarPlan(m.businessId, m.memberId, id, dto);
  }

  @Delete('membership-plans/:id')
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.settings.manage')
  borrarPlan(@CurrentBusiness() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    const m = assertMemberContext(ctx);
    return this.membresias.borrarPlan(m.businessId, m.memberId, id);
  }

  @Get('memberships')
  @RequiresAddon('ADVANCED')
  listar(@CurrentBusiness() ctx: AuthContext, @Query() q: ListMembershipsQuery) {
    return this.membresias.listar(assertMemberContext(ctx).businessId, q);
  }

  // Dar de alta cobra la primera cuota: además pide appointments.cash.charge (en el service).
  @Post('memberships')
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.settings.manage')
  crear(@CurrentBusiness() ctx: AuthContext, @Body() dto: CreateMembershipDto) {
    return this.membresias.crear(assertMemberContext(ctx), dto);
  }

  @Post('memberships/:id/pause')
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.settings.manage')
  pausar(@CurrentBusiness() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PauseMembershipDto) {
    const m = assertMemberContext(ctx);
    return this.membresias.pausar(m.businessId, m.memberId, id, dto);
  }

  @Post('memberships/:id/resume')
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.settings.manage')
  reanudar(@CurrentBusiness() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    const m = assertMemberContext(ctx);
    return this.membresias.reanudar(m.businessId, m.memberId, id);
  }

  @Post('memberships/:id/cancel')
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.settings.manage')
  cancelar(@CurrentBusiness() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    const m = assertMemberContext(ctx);
    return this.membresias.cancelar(m.businessId, m.memberId, id);
  }

  // Registrar la cuota a mano: el contrato pide appointments.cash.charge.
  @Post('memberships/:id/payments')
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.cash.charge')
  registrarCuota(@CurrentBusiness() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ConMedioDePagoDto) {
    const m = assertMemberContext(ctx);
    return this.membresias.registrarCuota(m.businessId, m.memberId, id, dto.method);
  }
}
