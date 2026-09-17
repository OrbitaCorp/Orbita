import { Module } from '@nestjs/common';
import { MemberProfileController } from './member-profile.controller';
import { MemberProfileService } from './member-profile.service';
import { EmailVerificationService } from './email-verification.service';

@Module({
  controllers: [MemberProfileController],
  providers: [MemberProfileService, EmailVerificationService],
})
export class MemberProfileModule {}
