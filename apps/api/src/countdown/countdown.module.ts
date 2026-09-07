import { Module } from '@nestjs/common';
import { StorefrontModule } from '../storefront/storefront.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { CountdownController } from './countdown.controller';
import { StorefrontCountdownController } from './storefront-countdown.controller';
import { CountdownService } from './countdown.service';

@Module({
  imports: [
    StorefrontModule, // resolveBusinessId()
    BusinessesModule, // hasActiveAddon() para el gate del endpoint público
  ],
  controllers: [CountdownController, StorefrontCountdownController],
  providers: [CountdownService],
})
export class CountdownModule {}
