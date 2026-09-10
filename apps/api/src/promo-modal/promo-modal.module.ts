import { Module } from '@nestjs/common';
import { PromoModalController } from './promo-modal.controller';
import { PromoModalService } from './promo-modal.service';
import { StorefrontPromoModalController } from './storefront-promo-modal.controller';
import { StorefrontModule } from '../storefront/storefront.module';
import { BusinessesModule } from '../businesses/businesses.module';

@Module({
  imports: [
    StorefrontModule, // resolveBusinessId() para StorefrontPromoModalController
    BusinessesModule, // hasActiveAddon() para el gate del endpoint público
  ],
  controllers: [PromoModalController, StorefrontPromoModalController],
  providers: [PromoModalService],
  exports: [PromoModalService],
})
export class PromoModalModule {}
