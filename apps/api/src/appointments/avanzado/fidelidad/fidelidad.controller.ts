import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { RequiresAddon } from '../../../common/decorators/requires-addon.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { AuthContext } from '../../../common/types/auth-context.type';
import { assertMemberContext } from '../../../common/utils/assert-member-context';
import { PaginacionDto } from '../comun/paginado';
import { FidelidadService } from './fidelidad.service';

// Programa de fidelidad (CONTRATO § P4.5).
@Controller('appointments/loyalty')
export class FidelidadController {
  constructor(private readonly fidelidad: FidelidadService) {}

  @Get()
  @RequiresAddon('ADVANCED')
  listar(@CurrentBusiness() ctx: AuthContext, @Query() q: PaginacionDto) {
    return this.fidelidad.listar(assertMemberContext(ctx).businessId, q);
  }

  @Post(':customerId/redeem')
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.settings.manage')
  canjear(@CurrentBusiness() ctx: AuthContext, @Param('customerId', ParseUUIDPipe) customerId: string) {
    const m = assertMemberContext(ctx);
    return this.fidelidad.canjear(m.businessId, m.memberId, customerId);
  }
}
