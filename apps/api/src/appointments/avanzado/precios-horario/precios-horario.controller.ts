import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { RequiresAddon } from '../../../common/decorators/requires-addon.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { AuthContext } from '../../../common/types/auth-context.type';
import { assertMemberContext } from '../../../common/utils/assert-member-context';
import { PreciosHorarioService } from './precios-horario.service';
import { UpsertPriceRuleDto } from './dto/upsert-price-rule.dto';

// Precios por horario (CONTRATO § P4.4). Lecturas: el add-on. Escrituras:
// además appointments.settings.manage.
@Controller('appointments/price-rules')
export class PreciosHorarioController {
  constructor(private readonly precios: PreciosHorarioService) {}

  @Get()
  @RequiresAddon('ADVANCED')
  listar(@CurrentBusiness() ctx: AuthContext) {
    return this.precios.listar(assertMemberContext(ctx).businessId);
  }

  @Post()
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.settings.manage')
  crear(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertPriceRuleDto) {
    const m = assertMemberContext(ctx);
    return this.precios.crear(m.businessId, m.memberId, dto);
  }

  @Put(':id')
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.settings.manage')
  editar(@CurrentBusiness() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpsertPriceRuleDto) {
    const m = assertMemberContext(ctx);
    return this.precios.editar(m.businessId, m.memberId, id, dto);
  }

  @Delete(':id')
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.settings.manage')
  borrar(@CurrentBusiness() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    const m = assertMemberContext(ctx);
    return this.precios.borrar(m.businessId, m.memberId, id);
  }
}
