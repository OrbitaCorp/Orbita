import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [SubscriptionsModule],
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
