import { Module } from '@nestjs/common';
import { StorefrontModule } from '../storefront/storefront.module';
import { SocialProofController } from './social-proof.controller';
import { StorefrontSocialProofController } from './storefront-social-proof.controller';
import { SocialProofService } from './social-proof.service';

@Module({
  imports: [StorefrontModule], // resolveBusinessId()
  controllers: [SocialProofController, StorefrontSocialProofController],
  providers: [SocialProofService],
})
export class SocialProofModule {}
