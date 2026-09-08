import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { RequiresAddon } from '../common/decorators/requires-addon.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { ExitIntentService } from './exit-intent.service';
import { UpsertExitIntentDto } from './dto/upsert-exit-intent.dto';

// Paquete "Avanzado" — gateado por AddonGuard en los tres endpoints, mismo
// patrón que PromoModalController.
@Controller('exit-intent')
export class ExitIntentController {
  constructor(private readonly exitIntentService: ExitIntentService) {}

  @Get()
  @RequiresAddon('ADVANCED')
  getExitIntent(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.exitIntentService.getForBusiness(member.businessId);
  }

  @Put()
  @RequiresAddon('ADVANCED')
  upsertExitIntent(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertExitIntentDto) {
    const member = assertMemberContext(ctx);
    return this.exitIntentService.upsert(member.businessId, dto);
  }

  @Patch('relanzar')
  @RequiresAddon('ADVANCED')
  relanzar(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.exitIntentService.relanzar(member.businessId);
  }
}
