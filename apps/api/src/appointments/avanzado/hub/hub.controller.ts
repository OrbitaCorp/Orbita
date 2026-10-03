import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { RequiresAddon } from '../../../common/decorators/requires-addon.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { AuthContext } from '../../../common/types/auth-context.type';
import { assertMemberContext } from '../../../common/utils/assert-member-context';
import { HubAvanzadoService } from './hub.service';
import { PutAdvancedDto } from './dto/config-avanzado.dto';

// Hub de Avanzado de Turnos (CONTRATO § P4). El GET NO lleva @RequiresAddon:
// el hub se muestra igual, con el candado.
@Controller('appointments/advanced')
export class HubAvanzadoController {
  constructor(private readonly hub: HubAvanzadoService) {}

  @Get()
  obtener(@CurrentBusiness() ctx: AuthContext) {
    return this.hub.obtener(assertMemberContext(ctx).businessId);
  }

  @Put(':funcion')
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.settings.manage')
  guardar(@CurrentBusiness() ctx: AuthContext, @Param('funcion') funcion: string, @Body() dto: PutAdvancedDto) {
    const m = assertMemberContext(ctx);
    return this.hub.guardar(m.businessId, m.memberId, funcion, dto);
  }
}
