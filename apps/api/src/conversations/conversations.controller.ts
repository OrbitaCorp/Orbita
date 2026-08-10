import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { FullModeOnly } from '../common/decorators/full-mode-only.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { ConversationsService } from './conversations.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

// Bandeja de mensajes del panel — cualquier miembro del negocio puede
// leer/contestar (no hace falta @Roles: un empleado también atiende clientes).
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @FullModeOnly()
  findAll(@CurrentBusiness() ctx: AuthContext) {
    const member = assertMemberContext(ctx);
    return this.conversationsService.findAllForBusiness(member.businessId);
  }

  @Get(':id/messages')
  @FullModeOnly()
  messages(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.conversationsService.getMessages(member.businessId, id);
  }

  @Post(':id/messages')
  @FullModeOnly()
  sendMessage(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: SendMessageDto) {
    const member = assertMemberContext(ctx);
    return this.conversationsService.sendMessage(member.businessId, id, dto);
  }

  @Patch(':id')
  @FullModeOnly()
  update(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpdateConversationDto) {
    const member = assertMemberContext(ctx);
    return this.conversationsService.update(member.businessId, id, dto);
  }
}
