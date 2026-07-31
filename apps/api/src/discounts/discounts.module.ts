import { Module } from '@nestjs/common';
import { DiscountsController } from './discounts.controller';
import { DiscountsService } from './discounts.service';
import { DiscountsMetricsService } from './discounts-metrics.service';

@Module({
  controllers: [DiscountsController],
  providers: [DiscountsService, DiscountsMetricsService],
})
export class DiscountsModule {}
