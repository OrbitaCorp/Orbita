import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { RequiresAddon } from '../../../common/decorators/requires-addon.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { AuthContext } from '../../../common/types/auth-context.type';
import { assertMemberContext } from '../../../common/utils/assert-member-context';
import { PaquetesService } from './paquetes.service';
import { ListPurchasesQuery, SellPackageDto, UpsertPackageDto } from './dto/paquetes.dto';

// Paquetes y bonos (CONTRATO § P4.1), lado del panel.
@Controller('appointments')
export class PaquetesController {
  constructor(private readonly paquetes: PaquetesService) {}

  @Get('packages')
  @RequiresAddon('ADVANCED')
  listar(@CurrentBusiness() ctx: AuthContext) {
    return this.paquetes.listar(assertMemberContext(ctx).businessId);
  }

  @Post('packages')
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.settings.manage')
  crear(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertPackageDto) {
    const m = assertMemberContext(ctx);
    return this.paquetes.crear(m.businessId, m.memberId, dto);
  }

  @Put('packages/:id')
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.settings.manage')
  editar(@CurrentBusiness() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertPackageDto) {
    const m = assertMemberContext(ctx);
    return this.paquetes.editar(m.businessId, m.memberId, id, dto);
  }

  @Delete('packages/:id')
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.settings.manage')
  borrar(@CurrentBusiness() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    const m = assertMemberContext(ctx);
    return this.paquetes.borrar(m.businessId, m.memberId, id);
  }

  @Get('package-purchases')
  @RequiresAddon('ADVANCED')
  listarCompras(@CurrentBusiness() ctx: AuthContext, @Query() q: ListPurchasesQuery) {
    return this.paquetes.listarCompras(assertMemberContext(ctx).businessId, q);
  }

  // Vender en el local cobra plata: además de settings.manage pide
  // appointments.cash.charge (se revisa en el service).
  @Post('package-purchases')
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.settings.manage')
  vender(@CurrentBusiness() ctx: AuthContext, @Body() dto: SellPackageDto) {
    return this.paquetes.vender(assertMemberContext(ctx), dto);
  }
}
