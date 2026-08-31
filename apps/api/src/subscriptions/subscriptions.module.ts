import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsWebhookController } from './subscriptions-webhook.controller';
import { SubscriptionsService } from './subscriptions.service';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { BranchesModule } from '../branches/branches.module';

@Module({
  imports: [OnboardingModule, BusinessesModule, BranchesModule],
  controllers: [SubscriptionsController, SubscriptionsWebhookController],
  providers: [SubscriptionsService],
  // PlatformModule lo usa para saber hasta que porcentaje puede llegar un
  // codigo de descuento sin caer por debajo del minimo de MP.
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
