import { Body, Controller, Get, Put } from '@nestjs/common';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { RequiresAddon } from '../common/decorators/requires-addon.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { CountdownService } from './countdown.service';
import { UpsertCountdownDto } from './dto/upsert-countdown.dto';

// Paquete "Avanzado" — gateado por AddonGuard, mismo patrón que
// PromoModalController. Sin "Relanzar" acá (a diferencia del modal de
// anuncios): el countdown no se cierra ni se descarta, así que no hay a quién
// volver a mostrárselo — cambiar la fecha ya alcanza para relanzar la promo.
@Controller('countdown')
export class CountdownController {
  constructor(private readonly countdownService: CountdownService) {}

  @Get()
  @RequiresAddon('ADVANCED')
  getCountdown(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.countdownService.getForBusiness(member.businessId);
  }

  @Put()
  @RequiresAddon('ADVANCED')
  upsertCountdown(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertCountdownDto) {
    const member = assertMemberContext(ctx);
    // memberId: el Discount que este módulo gestiona necesita `createdBy`,
    // igual que el del 2x1.
    return this.countdownService.upsert(member.businessId, member.memberId, dto);
  }
}
