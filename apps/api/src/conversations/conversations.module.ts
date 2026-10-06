import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { MeConversationController } from './me-conversation.controller';
import { ConversationsService } from './conversations.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [WhatsappModule], // responder por WhatsApp desde la bandeja
  controllers: [ConversationsController, MeConversationController],
  providers: [ConversationsService],
})
export class ConversationsModule {}
