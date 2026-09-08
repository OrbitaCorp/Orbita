import { Module } from '@nestjs/common';
import { StorefrontModule } from '../storefront/storefront.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { ExitIntentController } from './exit-intent.controller';
import { StorefrontExitIntentController } from './storefront-exit-intent.controller';
import { ExitIntentService } from './exit-intent.service';

@Module({
  imports: [
    StorefrontModule, // resolveBusinessId()
    BusinessesModule, // hasActiveAddon() para el gate del endpoint público
  ],
  controllers: [ExitIntentController, StorefrontExitIntentController],
  providers: [ExitIntentService],
})
export class ExitIntentModule {}
