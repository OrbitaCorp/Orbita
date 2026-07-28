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
})
export class SubscriptionsModule {}
