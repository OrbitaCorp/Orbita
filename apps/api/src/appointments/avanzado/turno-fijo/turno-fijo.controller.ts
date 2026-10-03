import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { RequiresAddon } from '../../../common/decorators/requires-addon.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { AuthContext } from '../../../common/types/auth-context.type';
import { assertMemberContext } from '../../../common/utils/assert-member-context';
import { TurnoFijoService } from './turno-fijo.service';
import { CreateRecurringDto } from './dto/turno-fijo.dto';

// Turno fijo (CONTRATO § P4.6).
@Controller('appointments/recurring')
export class TurnoFijoController {
  constructor(private readonly turnoFijo: TurnoFijoService) {}

  @Get()
  @RequiresAddon('ADVANCED')
  listar(@CurrentBusiness() ctx: AuthContext) {
    return this.turnoFijo.listar(assertMemberContext(ctx).businessId);
  }

  @Post()
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.settings.manage')
  crear(@CurrentBusiness() ctx: AuthContext, @Body() dto: CreateRecurringDto) {
    const m = assertMemberContext(ctx);
    return this.turnoFijo.crearDesdePanel(m.businessId, m.memberId, dto);
  }

  @Post(':id/end')
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.settings.manage')
  terminar(@CurrentBusiness() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    const m = assertMemberContext(ctx);
    return this.turnoFijo.terminar(m.businessId, m.memberId, id);
  }
}
