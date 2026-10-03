import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentBusiness } from '../../../common/decorators/current-business.decorator';
import { RequiresAddon } from '../../../common/decorators/requires-addon.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { AuthContext } from '../../../common/types/auth-context.type';
import { assertMemberContext } from '../../../common/utils/assert-member-context';
import { GiftCardsService } from './gift-cards.service';
import { EmitGiftCardDto, ListGiftCardsQuery } from './dto/gift-cards.dto';

// Gift cards (CONTRATO § P4.3), lado del panel.
@Controller('appointments/gift-cards')
export class GiftCardsController {
  constructor(private readonly giftCards: GiftCardsService) {}

  @Get()
  @RequiresAddon('ADVANCED')
  listar(@CurrentBusiness() ctx: AuthContext, @Query() q: ListGiftCardsQuery) {
    return this.giftCards.listar(assertMemberContext(ctx).businessId, q);
  }

  // Emitir en el local cobra plata: además pide appointments.cash.charge (en el service).
  @Post()
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.settings.manage')
  emitir(@CurrentBusiness() ctx: AuthContext, @Body() dto: EmitGiftCardDto) {
    return this.giftCards.emitir(assertMemberContext(ctx), dto);
  }

  @Post(':id/void')
  @RequiresAddon('ADVANCED')
  @RequirePermission('appointments.settings.manage')
  anular(@CurrentBusiness() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    const m = assertMemberContext(ctx);
    return this.giftCards.anular(m.businessId, m.memberId, id);
  }
}
