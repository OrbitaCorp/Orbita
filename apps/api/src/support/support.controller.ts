import { Body, Controller, Post } from '@nestjs/common';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { SupportService } from './support.service';
import { SendSupportRequestDto } from './dto/send-support-request.dto';

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  send(@CurrentBusiness() ctx: AuthContext, @Body() dto: SendSupportRequestDto) {
    const member = assertMemberContext(ctx);
    return this.supportService.send(member.businessId, member.memberId, dto);
  }
}
