import { Body, Controller, Get, Post } from '@nestjs/common';
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

  @Post('messages')
  @FullModeOnly()
  sendMyMessage(@CurrentUser() ctx: AuthContext, @Body() dto: CustomerMessageDto) {
    const { customerId, businessId } = assertCustomerContext(ctx);
    return this.conversationsService.sendMyMessage(businessId, customerId, dto);
  }
}
