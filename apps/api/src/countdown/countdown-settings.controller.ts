import { Body, Controller, Get, Put } from '@nestjs/common';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { RequiresAddon } from '../common/decorators/requires-addon.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { CountdownService } from './countdown.service';
import { UpdateCountdownSettingsDto } from './dto/update-countdown-settings.dto';

// Interruptor de "Oferta relámpago" (paquete Avanzado, RBT-675), lado del
// panel. La lectura la hace cualquier miembro (el formulario de Descuentos la
// usa para avisar quién tiene la oferta hoy); prender o apagar exige el
// add-on (AddonGuard) y rol de dueño/admin, mismo criterio que
// TwoForOneController.
@Controller('countdown')
export class CountdownSettingsController {
  constructor(private readonly countdown: CountdownService) {}

  @Get('settings')
  getSettings(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.countdown.getSettings(member.businessId);
  }

  @Put('settings')
  @RequiresAddon('ADVANCED')
  @Roles('owner', 'admin')
  setEnabled(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpdateCountdownSettingsDto) {
    const member = assertMemberContext(ctx);
    return this.countdown.setEnabled(member.businessId, dto.enabled);
  }
}
