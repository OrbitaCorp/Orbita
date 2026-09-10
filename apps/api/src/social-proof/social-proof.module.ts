import { Module } from '@nestjs/common';
import { StorefrontModule } from '../storefront/storefront.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { SocialProofController } from './social-proof.controller';
import { StorefrontSocialProofController } from './storefront-social-proof.controller';
import { SocialProofService } from './social-proof.service';

@Module({
  imports: [
    StorefrontModule, // resolveBusinessId()
    BusinessesModule, // hasActiveAddon() para el gate del endpoint público
  ],
  controllers: [SocialProofController, StorefrontSocialProofController],
  providers: [SocialProofService],
})
export class SocialProofModule {}
