import { Module } from '@nestjs/common';
import { MemberProfileController } from './member-profile.controller';
import { MemberProfileService } from './member-profile.service';

@Module({
  controllers: [MemberProfileController],
  providers: [MemberProfileService],
})
export class MemberProfileModule {}
