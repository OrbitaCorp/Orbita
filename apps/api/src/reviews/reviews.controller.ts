import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../common/decorators/roles.decorator';
import { FullModeOnly } from '../common/decorators/full-mode-only.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentBusiness } from '../common/decorators/current-business.decorator';
import { AuthContext } from '../common/types/auth-context.type';
import { assertCustomerContext } from '../common/utils/assert-customer-context';
import { assertMemberContext } from '../common/utils/assert-member-context';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { HideReviewDto } from './dto/hide-review.dto';
import { ReviewEligibilityQueryDto } from './dto/review-eligibility-query.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // Throttle propio (auditoría interna 10/09, ítem api.reviews). El tope real
  // por cliente es la unicidad cliente + producto + pedido.
  @Post()
  @FullModeOnly()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  create(@CurrentUser() ctx: AuthContext, @Body() dto: CreateReviewDto) {
    const { customerId, businessId } = assertCustomerContext(ctx);
    return this.reviewsService.create(businessId, customerId, dto);
  }

  @Get('eligibility')
  @FullModeOnly()
  eligibility(@CurrentUser() ctx: AuthContext, @Query() query: ReviewEligibilityQueryDto) {
    const { customerId, businessId } = assertCustomerContext(ctx);
    return this.reviewsService.eligibleFor(businessId, customerId, query.productId);
  }

  @Patch(':id/hide')
  @Roles('owner', 'admin')
  @FullModeOnly()
  hide(@CurrentBusiness() ctx: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: HideReviewDto) {
    const member = assertMemberContext(ctx);
    return this.reviewsService.hide(member.businessId, id, dto);
  }
}
