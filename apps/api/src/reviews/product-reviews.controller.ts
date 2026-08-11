import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { FullModeOnly } from '../common/decorators/full-mode-only.decorator';
import { ReviewsService } from './reviews.service';

@Controller('products')
export class ProductReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get(':id/reviews')
  @Public()
  @FullModeOnly()
  productReviews(@Param('id') id: string) {
    return this.reviewsService.listForProduct(id);
  }
}
