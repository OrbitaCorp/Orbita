import { Body, Controller, Get, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FullModeOnly } from '../common/decorators/full-mode-only.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertCustomerContext } from '../common/utils/assert-customer-context';
import { ConversationsService } from './conversations.service';
import { CustomerMessageDto } from './dto/customer-message.dto';

@Controller('me/conversation')
export class MeConversationController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @FullModeOnly()
  myThread(@CurrentUser() ctx: AuthContext) {
    const { customerId, businessId } = assertCustomerContext(ctx);
    return this.conversationsService.myThread(businessId, customerId);
  }

  // Throttle propio: sin él un cliente podía llenar la bandeja de la tienda
  // (auditoría interna 10/09, ítem api.conversations). La lectura de arriba
  // no lo lleva: la tienda la consulta cada pocos segundos.
  @Post('messages')
  @FullModeOnly()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  sendMyMessage(@CurrentUser() ctx: AuthContext, @Body() dto: CustomerMessageDto) {
    const { customerId, businessId } = assertCustomerContext(ctx);
    return this.conversationsService.sendMyMessage(businessId, customerId, dto);
  }
}
