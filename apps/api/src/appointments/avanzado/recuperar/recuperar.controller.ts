import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { RequiresAddon } from '../../../common/decorators/requires-addon.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { AuthContext } from '../../../common/types/auth-context.type';
import { assertMemberContext } from '../../../common/utils/assert-member-context';
import { RecuperarService } from './recuperar.service';
import { AudienceQuery, UpsertWinbackDto } from './dto/recuperar.dto';

// Recuperar clientes (CONTRATO § P4.7).
@Controller('appointments/winback')
export class RecuperarController {
  constructor(private readonly recuperar: RecuperarService) {}

  @Get()
  @RequiresAddon('ADVANCED')
  obtener(@CurrentBusiness() ctx: AuthContext) {
    return this.recuperar.obtener(assertMemberContext(ctx).businessId);
  }

  @Put()
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.settings.manage')
  guardar(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertWinbackDto) {
    const m = assertMemberContext(ctx);
    return this.recuperar.guardar(m.businessId, m.memberId, dto);
  }

  @Get('audience')
  @RequiresAddon('ADVANCED')
  audiencia(@CurrentBusiness() ctx: AuthContext, @Query() q: AudienceQuery) {
    return this.recuperar.audiencia(assertMemberContext(ctx).businessId, q.inactiveDays);
  }

  // 3 por día: cada envío le escribe a clientes reales.
  @Post('send')
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.settings.manage')
  @Throttle({ default: { limit: 3, ttl: 24 * 3600 * 1000 } })
  enviar(@CurrentBusiness() ctx: AuthContext) {
    const m = assertMemberContext(ctx);
    return this.recuperar.enviar(m.businessId, m.memberId);
  }
}
