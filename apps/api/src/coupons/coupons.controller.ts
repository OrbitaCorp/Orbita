import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { CouponsService } from './coupons.service';
import { UpsertCouponDto } from './dto/upsert-coupon.dto';
import { FindCouponsQueryDto } from './dto/find-coupons-query.dto';
import { SendCouponLinkEmailDto } from './dto/send-link-email.dto';

@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  findAll(@CurrentBusiness() ctx: AuthContext, @Query() query: FindCouponsQueryDto) {
    const member = assertMemberContext(ctx);
    return this.couponsService.findAll(member.businessId, query);
  }

  @Get(':id')
  findOne(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.couponsService.findOne(member.businessId, id);
  }

  @Post()
  @Roles('owner', 'admin')
  create(@CurrentBusiness() ctx: AuthContext, @Body() dto: UpsertCouponDto) {
    const member = assertMemberContext(ctx);
    return this.couponsService.create(member.businessId, member.memberId, dto);
  }

  @Post('link-email')
  @Roles('owner', 'admin')
  sendLinkEmail(@CurrentBusiness() ctx: AuthContext, @Body() dto: SendCouponLinkEmailDto) {
    const member = assertMemberContext(ctx);
    return this.couponsService.sendLinkEmail(member.businessId, dto);
  }

  @Put(':id')
  @Roles('owner', 'admin')
  update(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpsertCouponDto) {
    const member = assertMemberContext(ctx);
    return this.couponsService.update(member.businessId, id, dto);
  }

  @Patch(':id/toggle')
  @Roles('owner', 'admin')
  toggle(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.couponsService.toggle(member.businessId, id);
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  remove(@CurrentBusiness() ctx: AuthContext, @Param('id') id: string) {
    const member = assertMemberContext(ctx);
    return this.couponsService.remove(member.businessId, id);
  }
}
