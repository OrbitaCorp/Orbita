import { Module } from '@nestjs/common';
import { PromoModalController } from './promo-modal.controller';
import { PromoModalService } from './promo-modal.service';
import { StorefrontPromoModalController } from './storefront-promo-modal.controller';
import { StorefrontModule } from '../storefront/storefront.module';

@Module({
  imports: [StorefrontModule], // resolveBusinessId() para StorefrontPromoModalController
  controllers: [PromoModalController, StorefrontPromoModalController],
  providers: [PromoModalService],
  exports: [PromoModalService],
})
export class PromoModalModule {}
