import { Body, Controller, Get, Put } from '@nestjs/common';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { RequiresAddon } from '../common/decorators/requires-addon.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { TwoForOneService } from './two-for-one.service';
import { UpsertTwoForOneDto } from './dto/upsert-two-for-one.dto';

// "2x1 y 3x2" (paquete Avanzado, RBT-675) — gateado por AddonGuard en los dos
// endpoints, mismo patrón que PromoModalController. Panel únicamente: el
// consumo real (el motor aplicando el descuento, el badge del catálogo) pasa
// por DiscountsService/StorefrontService, no por acá.
@Controller('two-for-one')
export class TwoForOneController {
  constructor(private readonly twoForOne: TwoForOneService) {}

  @Get()
  @RequiresAddon('ADVANCED')
  getConfig(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.twoForOne.getForBusiness(member.businessId);
  }

  @Put()
  @RequiresAddon('ADVANCED')
  upsert(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertTwoForOneDto) {
    const member = assertMemberContext(ctx);
    return this.twoForOne.upsert(member.businessId, member.memberId, dto);
  }
}
