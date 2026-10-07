import { Module } from '@nestjs/common';
import { InstagramController } from './instagram.controller';
import { InstagramWebhookController } from './instagram-webhook.controller';
import { InstagramService } from './instagram.service';

@Module({
  controllers: [InstagramController, InstagramWebhookController],
  providers: [InstagramService],
  exports: [InstagramService], // ConversationsService responde por Instagram; el cron renueva los tokens
})
export class InstagramModule {}
